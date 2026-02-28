# Guvenlik ve Hata Bulgulari

Bu liste kod tabaninin statik incelenmesi ve yerel komut ciktisina gore hazirlandi.

## Kritik

1. **`SECURITY DEFINER` fonksiyonlarinda yetki kisitlamasi yok (RPC ile cagrilabilir).**
   - Kanit:
     - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:23`
     - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:69`
     - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:121`
     - `supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql:174`
     - Bu fonksiyonlar `security definer`; ancak `revoke/grant` yok.
     - Karsilastirma: `supabase/migrations/20260216130000_automation_events.sql:100` ve `:101` sadece `claim_automation_events` icin yetki kisitliyor.
   - Etki:
     - Anon/authenticated kullanicilar, RPC uzerinden event uretim fonksiyonlarini tetikleyebilir.
     - Planlanmamis/erken event olusumu ve otomasyon akisinin manipule edilmesi mumkun.

2. **Stripe premium aktivasyonu odeme urunu/fiyat dogrulamasini yapmiyor (mantik acigi).**
   - Kanit:
     - `src/app/api/stripe/confirm/route.ts:67` (yalnizca `client_reference_id` varsa user eslestiriyor)
     - `src/app/api/stripe/confirm/route.ts:71` (tamamlanma kontrolu sadece durum odakli)
     - `src/app/api/stripe/confirm/route.ts:75` (dogrudan `plan: "premium"` yaziyor)
   - Etki:
     - Session tamamlanmis gorunuyorsa (farkli urun/fiyat dahil) premiuma gecis riski.
     - Session-user bagi `client_reference_id` yoksa zayif kaliyor.

## Yuksek

3. **`/api/debug/plan` production guard eksik; CI kontrolu zaten fail veriyor.**
   - Kanit:
     - `src/app/api/debug/plan/route.ts:6` (prod 404 guard yok)
     - `src/app/api/debug/plan/route.ts:22` (`uid`, `plan`, `profileExists` donuyor)
     - `scripts/check-debug-plan-prod.cjs:15` bu guardi zorunlu tutuyor.
     - `npm run check:debug-plan-prod` komutu: `Missing production guard in /api/debug/plan route.`
   - Etki:
     - Production'da debug endpoint acik kalirsa bilgi sizintisi.

4. **`/api/dashboard-metrics` kimliksiz cagriya global metrik donebiliyor.**
   - Kanit:
     - `src/app/api/dashboard-metrics/route.ts:355` (`getOptionalUser`)
     - `src/app/api/dashboard-metrics/route.ts:357` (`user` yoksa ve service role varsa `global`)
     - `src/app/api/dashboard-metrics/route.ts:381` (global sayilar donuyor)
   - Etki:
     - Kimliksiz istekle isletme metriklerinin sizmasi (activeUsers, trackedAssets vb.).

5. **Automation dispatcher secret yoksa endpoint acik kaliyor.**
   - Kanit:
     - `supabase/functions/automation-dispatcher/index.ts:13` (`AUTOMATION_CRON_SECRET` bos olabilir)
     - `supabase/functions/automation-dispatcher/index.ts:51` (kontrol sadece secret doluysa calisiyor)
     - `supabase/functions/automation-dispatcher/index.ts:68` (RPC ile due event emit tetikleniyor)
   - Etki:
     - Secret konfig edilmezse disaridan POST ile otomasyon akisina mudahale.

6. **Yerel dizinde canli hassas anahtarlar mevcut (opsec riski).**
   - Kanit:
     - `.env.local:2` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
     - `.env.local:3` (`SUPABASE_SERVICE_ROLE_KEY`)
     - `.env.local:5` (`STRIPE_SECRET_KEY` - live format)
     - `testsprite_tests/tmp/config.json:7` (proxy kimlik bilgisi URL icinde)
   - Etki:
     - Yanlislikla commit/screenshot/log ile sizar ise hesap ele gecirme ve servis istismari.

## Orta

7. **`subscription-request` endpointi ile RLS politikasi celisiyor (fonksiyonel hata + guvenlik tasarim acigi).**
   - Kanit:
     - API insert: `src/app/api/subscription-request/route.ts:60`
     - RLS deny-all: `supabase/migrations/20260215193000_subscription_requests.sql:22`-`:26`
     - Dokumanda service-role beklentisi: `docs/setup/supabase.md:35`
   - Etki:
     - Endpoint pratikte calismayabilir veya beklenen yetki modeliyle uyumsuzdur.

8. **Stripe checkout URL olusturma `host/x-forwarded-host` tabanli (header kaynakli yonlendirme riski).**
   - Kanit:
     - `src/app/api/stripe/checkout/route.ts:14`
     - `src/app/api/stripe/checkout/route.ts:26`
     - `src/app/api/stripe/checkout/route.ts:97`
   - Etki:
     - `APP_URL` sabitlenmezse callback URL host manipule edilebilir.

9. **Ic hata mesajlari son kullaniciya acikca donuyor (bilgi sizintisi).**
   - Kanit (ornekler):
     - `src/app/api/assets/route.ts:219`
     - `src/app/api/assets/route.ts:393`
     - `src/app/api/audit-logs/route.ts:84`
     - `src/app/api/debug/plan/route.ts:19`
     - `src/app/api/panel-health/route.ts:283`
   - Etki:
     - Saldirganlar schema/durum/altyapi hakkinda daha fazla bilgi toplayabilir.

10. **Pahali AI endpointlerinde hiz limiti/kota korumasi gorunmuyor.**
    - Kanit:
      - `src/app/api/maintenance-predictions/route.ts:374`
      - `src/app/api/service-media/route.ts:302`
      - `src/app/api/service-media/route.ts:334`
    - Etki:
      - Hesap ele gecirme veya suistimal durumunda maliyet artisi/servis yavaslamasi.

11. **`service-media` yuklemelerinde dosya boyutu denetimi eksik (AI on-isleme bellek maliyeti).**
    - Kanit:
      - `src/app/api/service-media/route.ts:504` (`validateMediaFile` boyut kontrolu yapmiyor)
      - `src/app/api/service-media/route.ts:360` (fotografi base64'e tamamen aliyor)
    - Etki:
      - Buyuk dosyalarda bellek tuketimi ve yanit suresi problemleri.

## Dusuk

12. **Global guvenlik header'lari tanimli degil.**
    - Kanit:
      - `next.config.ts:3` (`nextConfig` bos)
    - Etki:
      - CSP/HSTS/X-Frame-Options gibi ek katmanlar yok.

## Bagimlilik Aciklari (otomatik tarama)

13. **`npm audit` bulgulari mevcut.**
    - Komut: `npm audit --json`
    - Ozet:
      - `jspdf` (direct dep) high (`package.json:21`, aralik: `<4.2.0`)
      - `minimatch` high (transitive/dev)
      - `ajv` moderate (transitive/dev)
    - Etki:
      - Ozellikle `jspdf` icin bilinen PDF injection/DoS danismanliklari var.
