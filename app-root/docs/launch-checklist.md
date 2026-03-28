# Launch Checklist

Bu checklist, canliya cikis oncesi minimum go/no-go kontrol listesidir.

## 1. Build ve temel kalite kapisi

- [ ] `npm ci`
- [ ] `npm run lint -- --max-warnings=0`
- [ ] `npm run build`
- [ ] `npm run security:check`
- [ ] `npm run test:rls:negative`
- [ ] `npm run test:abuse:rate-limit`
- [ ] `npm run test:e2e`

Stable seed hesaplari hazirsa ek olarak:

- [ ] `npm run test:seed`
- [ ] `npm run test:stable`

## 2. Veri ve altyapi hazirligi

- [ ] Tum guncel Supabase migrationlari uygulanmis
- [ ] `billing_subscriptions`, `billing_invoices` ve `stripe_webhook_events` tablolari mevcut
- [ ] `documents-private` ve `asset-media` bucket'lari mevcut
- [ ] Dashboard, panel health ve rate limit RPC'leri calisiyor
- [ ] Backup/PITR aktif
- [ ] Son restore drill sonucu kayitli

## 3. Secret ve entegrasyonlar

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `APP_URL` ve `NEXT_PUBLIC_APP_URL`
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, premium price env'i
- [ ] `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, release/env ayarlari
- [ ] `SERVICE_MEDIA_JOB_SECRET`
- [ ] `PANEL_HEALTH_SECRET` ve gerekiyorsa `PANEL_HEALTH_PUBLIC_VISIBILITY`
- [ ] OpenAI ve worker secret'lari ilgili ortamlarda tanimli

## 4. Asenkron bilesenler

- [ ] `automation-dispatcher` deploy edildi
- [ ] `media-enrichment` deploy edildi
- [ ] `automation-dispatcher` cron schedule aktif
- [ ] Stripe webhook endpoint'i canli URL'ye bagli
- [ ] Webhook event'leri idempotent olarak isleniyor

## 5. Urun davranisi dogrulamalari

- [ ] Free hesap asset/document/subscription/invoice limitlerini asamiyor
- [ ] Premium hesap analytics, otomasyon ve premium medya akislarina erisebiliyor
- [ ] Billing schema yoksa API kontrollu olarak `BILLING_FEATURE_DISABLED` donuyor
- [ ] Auth olmayan veya e-posta dogrulanmamis kullanici korumali alanlara giremiyor
- [ ] Assets, documents, reports ve dashboard ekranlari kritik hata vermeden aciliyor

## 6. Go/No-Go

Canliya cikis icin asagidaki dort alanin hepsi yesil olmali:

- [ ] Zorunlu testler gecti
- [ ] Veri ve secret kurulumu dogrulandi
- [ ] Smoke test tamamlandi
- [ ] Rollback sahibi ve adimlari net

## Manual Verification

- Hosting provider uzerindeki son deploy/promote adimi
- Domain, TLS ve varsa WAF ayarlari
- Stripe canli mod endpoint eslesmesi
- Backup/PITR ve restore drill kaniti
- Sentry alarm rotalari ve on-call sahibi

## Ilgili Belgeler

- [release-gate-status.md](./release-gate-status.md)
- [rollback-guide.md](./rollback-guide.md)
- [monitoring-guide.md](./monitoring-guide.md)
- [qa/smoke-test-checklist.md](./qa/smoke-test-checklist.md)
