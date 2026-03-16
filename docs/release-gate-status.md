# Release Gate Status

Tarih: 2026-03-16

## Genel Durum

- Repo durumu: kosullu hazir
- Launch gate: acik degil

Kod tabani release'e yakin gorunuyor, fakat canliya cikis icin repo disi operasyonel dogrulamalar hala gerekli.

## Repo Icinde Hazir Gorunenler

- Node 20 tabanli build ve lint akislari tanimli
- CI workflow'u mevcut: `gitleaks_scan`, `lint_build`, `stable_tests`, `rls_negative_test`, `rate_limit_abuse_test`
- Stripe checkout, confirm ve webhook route'lari mevcut
- Sentry entegrasyonu repo icinde mevcut
- RLS, rate limit ve stable suite scriptleri package scriptlerinde tanimli
- Supabase functions kaynaklari repoda mevcut

## Launch Oncesi Zorunlu Dogrulamalar

- Production env'lerinde Supabase, Stripe ve Sentry secret'larini dogrula
- `automation-dispatcher` ve `media-enrichment` function'larini deploy et
- `SERVICE_MEDIA_JOB_SECRET` ve otomasyon secret'larini tanimla
- Stripe webhook endpoint'ini canli URL ile bagla ve test et
- Backup/PITR ve restore drill sonucunu kayda gecir
- Staging veya production-benzeri ortamda RLS ve rate limit testlerini tekrar kos

## Guclu Sekilde Onerilenler

- Stable suite'i seed kullanicilarla tekrar kos
- Panel health gorunurluk kararini netlestir
- Sentry alarm/notification akislarini operasyonel olarak tamamla
- PDF export plan kuralini urun karariyla hizala

## Bilinen Acik Nokta

- Rapor ekraninda export butonu kod seviyesinde su anda acik geciliyor. Plan bazli PDF kilidi isteniyorsa manuel dogrulama ve muhtemel kod duzeltmesi gerekir.

## Minimum Release Komutlari

```bash
npm ci
npm run lint -- --max-warnings=0
npm run build
npm run security:check
npm run test:rls:negative
npm run test:abuse:rate-limit
npm run test:e2e
```

Stable senaryolar icin:

```bash
npm run test:seed
npm run test:stable
```
