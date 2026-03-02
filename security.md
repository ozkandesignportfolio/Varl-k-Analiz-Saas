# Security Review - AssetCare

Bu dokuman, kod tabaninin statik incelemesi ve yerel bagimlilik taramasi (`npm audit`) ile hazirlandi.
Dinamik pentest, runtime cloud konfig denetimi ve prod verisi ile dogrulama yapilmadi.

## Scope

- Uygulama kodu: `src/`, `middleware.ts`
- Supabase: `supabase/migrations/`, `supabase/functions/`
- Konfig ve artefaktlar: `package.json`, `testsprite_tests/tmp/config.json`

## Executive Summary

- Kritik/HIGH etki olusturan en buyuk risk: Supabase migration icindeki worker invoke fonksiyonunun fallback URL davranisi nedeniyle service-role token sizdirma riski.
- Ikinci kritik risk: otomasyon event ureten `security definer` fonksiyonlarinda acik `EXECUTE` izinleri (global default revoke yoksa) ile queue spam/abuse riski.
- Ayrica prod debug endpointi, oran-sinir RPC tasarimi, checkout host cozumleme ve bagimlilik aciklari tespit edildi.

## Findings

### C-01 - Service Role Key Exfiltration via Hardcoded Fallback URL
Status: FIXED (2026-03-02)
- Severity: **Critical**
- Kanit:
  - `supabase/migrations/20260228133000_media_enrichment_jobs_queue_refactor.sql:119`
  - `supabase/migrations/20260228133000_media_enrichment_jobs_queue_refactor.sql:123`
  - `supabase/migrations/20260228133000_media_enrichment_jobs_queue_refactor.sql:130`
  - `supabase/migrations/20260228133000_media_enrichment_jobs_queue_refactor.sql:134`
- Aciklama:
  - `invoke_media_enrichment_worker()` fonksiyonu `app.settings.supabase_url` yoksa sabit bir proje URL'sine (`https://frufbnurxhtrialetjdg.supabase.co`) fallback ediyor.
  - Ayni cagrida `Authorization: Bearer <service_role_key>` header'i gonderiliyor.
  - Sonuc: `service_role_key` yanlis/harici hosta gidebilir.
- Etki:
  - Service role anahtarinin ifsasi, tum veritabani ve storage yetkilerinin ele gecirilmesine kadar gidebilir.
- Oneri:
  - Hardcoded URL fallback'ini kaldirin.
  - `supabase_url` tanimli degilse fonksiyon `return` etsin.
  - Key transferi yerine function invocation auth modeli degistirilsin (m2m secret rotation + allowlist host kontrolu).

### H-01 - Security Definer Event Emit Fonksiyonlarinda Execute Yetki Riski
Status: FIXED (2026-03-02)
- Severity: **High** (konfig varsayimina bagli)
- Kanit:
  - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:23`
  - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:69`
  - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:121`
  - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:174`
  - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:205`
  - Karsilastirma icin sadece claim fonksiyonunda kisit var:
    - `supabase/migrations/20260216130000_automation_events.sql:100`
    - `supabase/migrations/20260216130000_automation_events.sql:101`
- Aciklama:
  - Event ureten fonksiyonlar `security definer`.
  - Bu fonksiyonlar icin explicit `revoke/grant execute` gorulmuyor.
  - Inference: PostgreSQL default `EXECUTE` izinleri `PUBLIC` ise, yetkisiz RPC cagrilariyla event queue sisirilebilir.
- Etki:
  - Notification/email/push otomasyonlarinda spam, maliyet artisi, is kuyrugu suistimali.
- Oneri:
  - Tum `emit_*` ve `enqueue_*` fonksiyonlarinda:
    - `revoke all on function ... from public, anon, authenticated;`
    - yalnizca `service_role` (veya gerekli minimum rol) icin `grant execute`.
  - Ayrica fonksiyon icinde rol dogrulamasi ekleyin (`request.jwt.claim.role`).

### H-02 - Automation Dispatcher Secret Optional (Misconfig ile Public Trigger)
Status: FIXED (2026-03-02)
- Severity: **High**
- Kanit:
  - `supabase/functions/automation-dispatcher/index.ts:13`
  - `supabase/functions/automation-dispatcher/index.ts:51`
  - `supabase/functions/automation-dispatcher/index.ts:68`
- Aciklama:
  - `AUTOMATION_CRON_SECRET` bos ise `x-cron-secret` kontrolu bypass ediliyor.
  - Bu durumda endpoint disaridan tetiklenebilir.
- Etki:
  - Yetkisiz event emit ve action dispatch tetiklenmesi, maliyet/operasyon etkisi.
- Oneri:
  - Secret zorunlu olmali; yoksa endpoint 503/500 donmeli.
  - Ek olarak IP allowlist veya signed request dogrulamasi eklenmeli.

### H-03 - Repository Icerisinde Plaintext Proxy Credentials
- Severity: **High**
- Kanit:
  - `testsprite_tests/tmp/config.json:7`
- Aciklama:
  - Proxy URL icinde `username:password@host` formatinda credential tutuluyor.
- Etki:
  - Credential sizintisi, dis servis suistimali ve lateral movement riski.
- Oneri:
  - Dosyayi repodan cikarin, credential rotate edin.
  - `testsprite_tests/tmp/` benzeri gecici klasorleri `.gitignore` ile dislayin.

### M-01 - Debug Endpoint Production Guard Eksik
- Severity: **Medium**
- Kanit:
  - `src/app/api/debug/plan/route.ts:6`
  - `src/app/api/debug/plan/route.ts:19`
  - `src/app/api/debug/plan/route.ts:24`
  - `scripts/check-debug-plan-prod.cjs:15`
  - `scripts/check-debug-plan-prod.cjs:19`
- Aciklama:
  - Endpoint prod ortamda 404'e kapanacak guardi icermiyor.
  - Endpoint `uid`, `plan`, `profileExists` gibi debug verileri donuyor.
- Etki:
  - Bilgi sizintisi ve gereksiz attack surface.
- Oneri:
  - Route basinda prod kontrolu ve 404 donusu ekleyin.

### M-02 - Rate Limit RPC Subject Tampering Tasarimi
- Severity: **Medium**
- Kanit:
  - `supabase/migrations/20260228183000_api_rate_limit_leaky_bucket.sql:22`
  - `supabase/migrations/20260228183000_api_rate_limit_leaky_bucket.sql:24`
  - `supabase/migrations/20260228183000_api_rate_limit_leaky_bucket.sql:36`
  - `supabase/migrations/20260228183000_api_rate_limit_leaky_bucket.sql:134`
- Aciklama:
  - `take_api_rate_limit_token` `p_subject` parametresini caller'dan aliyor; fonksiyon `security definer` ve `authenticated` role execute izni var.
  - Kullanici ID'leri biliniyorsa farkli subject'ler adina token durumu manipule edilebilir.
- Etki:
  - Rate-limit davranisinin kirletilmesi / potansiyel DoS.
- Oneri:
  - `authenticated` cagrida `p_subject = auth.uid()` zorunlu olsun.
  - Alternatif: bu fonksiyonu sadece `service_role`a acin.

### M-03 - Stripe Checkout Base URL Host Header Uzerinden Cozuluyor
- Severity: **Medium**
- Kanit:
  - `src/app/api/stripe/checkout/route.ts:7`
  - `src/app/api/stripe/checkout/route.ts:16`
  - `src/app/api/stripe/checkout/route.ts:22`
  - `src/app/api/stripe/checkout/route.ts:97`
  - `src/app/api/stripe/checkout/route.ts:98`
- Aciklama:
  - `NEXT_PUBLIC_APP_URL/APP_URL` yoksa host `x-forwarded-host`/`host` header'dan uretiliyor.
  - Misconfigured proxy katmanlarinda callback URL manipule riski dogar.
- Etki:
  - Yanlis domain'e yonlenen success/cancel URL akisi.
- Oneri:
  - Prod'da `APP_URL` zorunlu hale getirilsin.
  - Header fallback kaldirilsin veya allowlist/domain pinning uygulansin.

### M-04 - Global Metrics Cache Anon Role'a Acik
- Severity: **Medium**
- Kanit:
  - `supabase/migrations/20260228180000_global_metrics_cache.sql:14`
  - `supabase/migrations/20260228180000_global_metrics_cache.sql:17`
  - `supabase/migrations/20260228180000_global_metrics_cache.sql:28`
  - `supabase/migrations/20260228180000_global_metrics_cache.sql:29`
- Aciklama:
  - Policy `using (true)` ve `anon`a `select` grant var.
  - Bu tablo global business KPI (`activeUsers`, `trackedAssets`, vb.) sakliyor.
- Etki:
  - Public metrik sizintisi (is zekasi/rekabet bilgisi).
- Oneri:
  - `anon` select'i kaldirin.
  - Gerekirse sadece server-side/service-role ile expose edin.

### D-01 - Dependency Vulnerabilities (`npm audit`)
- Severity: **High/Moderate (pakete gore)**
- Kanit:
  - `package.json:22` (`jspdf@^4.1.0`)
  - `npm audit --json` sonucu:
    - `jspdf` high (birden fazla advisory)
    - `minimatch` high (transitive)
    - `ajv` moderate (transitive)
- Etki:
  - Ozellikle `jspdf` tarafinda injection/DoS advisory'leri mevcut.
- Oneri:
  - `jspdf` 4.2.0+ seviyesine guncelleyin.
  - `npm audit fix` + lockfile refresh + regression test uygulayin.

## Prioritized Remediation Plan

1. `C-01` icin migration patch: hardcoded URL fallback kaldirilsin, key outbound transfer engellensin.
2. `H-01` icin `emit_*`/`enqueue_*` fonksiyon execute izinleri role-bazli kilitlensin.
3. `H-02` icin dispatcher secret zorunlu hale getirilsin.
4. `H-03` icin exposed credential rotate + repo temizligi.
5. `M-01`, `M-02`, `M-03`, `M-04` icin API ve DB permission hardening.
6. Bagimlilik guncelleme ve tekrar `npm audit`.

## Validation Commands

```bash
# Debug route prod guard check
npm run check:debug-plan-prod

# Dependency scan
npm audit --json

# SQL tarafi (Supabase SQL editor) execute privilege dogrulamasi ornegi
select proname, proacl
from pg_proc
join pg_namespace n on n.oid = pg_proc.pronamespace
where n.nspname = 'public'
  and proname in (
    'emit_warranty_due_events',
    'emit_maintenance_due_events',
    'emit_subscription_due_events',
    'emit_due_automation_events',
    'enqueue_maintenance_due_event_on_rule_change'
  );
```










