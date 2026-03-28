# Monitoring Guide

Bu belge, production ortaminda her release ve gundelik operasyon icin izlenmesi gereken ana sinyalleri toplar.

## 1. Uygulama sagligi

Izle:

- Uygulamanin acilmasi ve `/login` ile `/dashboard` erisimi
- 5xx hata orani
- API latency ve timeout artisleri
- Build/release sonrasi yeni hata dalgasi

Kaynaklar:

- Hosting health checks
- Sentry
- Panel health endpoint'i veya dashboard'u

## 2. Auth ve veri izolasyonu

Izle:

- Dogrulanmamis kullanicilarin korumali alanlara erisememesi
- Ani 401/403 artislari
- RLS kaynakli read/write hatalari

Ozellikle release sonrasi:

- Login
- Protected route redirect
- Bearer token ile API erisimi

## 3. Supabase

Izle:

- Migration drift belirtileri
- RPC/schema cache hatalari
- DB connection ve sorgu hata oranlari
- Storage upload/read hatalari

Kritik alanlar:

- Dashboard metrics
- Panel health
- Assets listeleme
- Rate limit RPC

## 4. Stripe ve billing

Izle:

- Checkout olusturma hatalari
- Confirm adimi sonrasi tutarsiz plan durumu
- Webhook imza veya delivery hatalari
- `BILLING_FEATURE_DISABLED` yanitinda beklenmeyen artis

Kontrol noktasi:

- `billing_subscriptions`
- `billing_invoices`
- `stripe_webhook_events`

## 5. Worker ve otomasyon

Izle:

- `automation-dispatcher` calisma basarisi
- `/api/automation/dispatch` 401/429/5xx artisleri
- Cron tetiklerinin durmasi
- `media-enrichment` job backlog'u
- `SERVICE_MEDIA_JOB_SECRET` kaynakli 401/403 hatalari
- `automation_events.last_error` ve `automation_events.action_results` icindeki email skip/fail nedenleri

## 6. Alarm oncelikleri

P1:

- Login veya dashboard erisilemez
- Stripe checkout veya webhook calismaz
- Yaygin 5xx artisi
- RLS/regresyon sebebiyle kullanici verisi okunamaz

P2:

- Worker/cron durmus ama ana urun akislari calisiyor
- Asset media veya document upload hatalari artiyor
- Stable suite senaryolari yeni release sonrasi bozuluyor

P3:

- Panel health visibility/config uyumsuzlugu
- Sentry source map veya release etiketi eksigi

## Release sonrasi ilk 30 dakika

- [ ] Sentry yeni fatal veya high-volume hata var mi
- [ ] Login ve dashboard canli smoke testi gecti mi
- [ ] Stripe webhook yeni event aliyor mu
- [ ] Worker/cron son tetik zamani normal mi
- [ ] Storage upload ve asset detail acilisi normal mi

## Manual Verification

- Alarm hedefleri, on-call rotasi ve escalation zinciri
- Hosting provider metrik/dashboard sahipligi
- Supabase production gozlem panellerinin exact URL'leri
- Stripe dashboard webhook izleme sorumlusu

## Ilgili Belgeler

- [security.md](./security.md)
- [rollback-guide.md](./rollback-guide.md)
- [qa/smoke-test-checklist.md](./qa/smoke-test-checklist.md)
