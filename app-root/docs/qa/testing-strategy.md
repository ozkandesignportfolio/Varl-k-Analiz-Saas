# Testing Strategy

Bu belge, repo icindeki test katmanlarini ve release icin beklenen minimum kapsami ozetler.

## Hedef

Amac, kritik SaaS risklerini erken yakalamak:

- auth ve e-posta dogrulama
- RLS ve veri izolasyonu
- billing/Stripe akislari
- rate limit ve kotaya dayali davranis
- assets/documents/storage
- release sonrasi temel kullanici akislari

## Test katmanlari

### 1. Yerel hizli kontrol

Her degisiklikte:

- `npm run lint -- --max-warnings=0`
- `npm run build`

Amac:

- Tip, route ve build regresyonlarini erken yakalamak

### 2. Guvenlik ve sertlestirme

Release oncesi zorunlu:

- `npm run security:check`
- `npm run test:rls:negative`
- `npm run test:abuse:rate-limit`

Amac:

- Yetkisiz erisim ve abuse regresyonlarini yakalamak

### 3. E2E ve stabil senaryolar

Release oncesi:

- `npm run test:e2e`

Seed hesaplari mevcutsa:

- `npm run test:seed`
- `npm run test:stable`

Amac:

- Free ve premium hesapla cekirdek urun akislarini dogrulamak

### 4. Manual smoke test

Her staging/prod deploy sonrasinda:

- [smoke-test-checklist.md](./smoke-test-checklist.md)

Amac:

- Entegrasyon ve ortam kaynakli sorunlari yakalamak

## Ortam beklentileri

- Local: hizli build ve temel davranis
- CI: lint/build + security + negatif testler
- Staging veya production-benzeri ortam: e2e + stable + smoke
- Production: kisa smoke + monitoring takibi

## Veri stratejisi

- En az bir free hesap
- En az bir premium hesap
- Asset, document, subscription ve invoice iceren seed veri
- Billing ve webhook akislarini gozlemek icin test event'leri

## Risk bazli oncelik

En yuksek oncelik:

- Login/regression
- RLS/veri sizintisi riski
- Stripe checkout/webhook
- Assets ve documents erisimi

Ikinci seviye:

- Worker/cron
- Reports ve analytics
- Notification akislar

## Release exit criteria

- Zorunlu test komutlari gecti
- Smoke test gecti
- Manual verification maddeleri acikca not edildi
- Bilinen riskler launch owner tarafindan kabul edildi

## Manual Verification

- Gercek production secret'lari ile billing
- Backup/restore ve PITR provasi
- Mobil cihaz ve gercek dosya yukleme davranisi
