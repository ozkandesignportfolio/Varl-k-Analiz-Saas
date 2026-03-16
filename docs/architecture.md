# Mimari Genel Bakis

## Teknoloji Yigini

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres ve Storage
- Stripe
- Chart.js
- jsPDF
- Sentry

## Uygulama Katmanlari

### Route ve UI

- Sayfalar `src/app` altinda App Router ile tanimlidir.
- Route gruplari kullaniliyor: `(auth)`, `(protected)`, `(legal)`.
- Sayfalar cogunlukla `src/features/*` altindaki container bileşenlerini render eder.

### API

API route'lari `src/app/api` altindadir. Ana alanlar:

- `assets`
- `asset-media`
- `maintenance-rules`
- `maintenance-predictions`
- `service-logs`
- `service-media`
- `service-media/jobs`
- `documents`
- `reports`
- `dashboard-metrics`
- `panel-health`
- `billing/subscriptions`
- `billing/invoices`
- `stripe/checkout`
- `stripe/confirm`
- `stripe/webhook`

### Domain ve veri erisim katmani

- Supabase browser/server wrapper'lari `src/lib/supabase` altindadir.
- Repo katmani `src/lib/repos` altinda toplanmistir.
- Plan, limit, billing schema guard, rate limit ve public error mantigi `src/lib` altinda ayridir.

## Veri Akisi

1. Kullanici sayfaya gelir.
2. `middleware.ts` korumali rota icin oturum kontrolu yapar.
3. API route gerekirse `requireRouteUser` ile kullaniciyi tekrar dogrular.
4. Veri Supabase ve RLS uzerinden okunur/yazilir.
5. Bazi agir sorgular DB RPC ve cache katmani uzerinden calisir.

## Asenkron ve Harici Bilesenler

### Supabase Edge Functions

- `automation-dispatcher`
- `media-enrichment`

Bu ikisi deploy edilmeden ana CRUD akislarinin cogu calisir, ama otomasyon ve medya enrichment eksik kalir.

### Stripe

- Checkout session olusturma
- Success sonrası confirm
- Webhook ile idempotent event isleme

### OpenAI

- Bakim tahmini ve medya enrichment tarafinda kullanilabilir
- Secret yoksa ilgili akislar fallback veya kapali modda devam eder

### Sentry

- Next.js entegrasyonu repoda mevcut
- Prod ayarlari yanlissa uygulama warning uretir

## Depolama ve RPC

- Dokumanlar `documents-private` bucket'inda tutulur.
- Varlik medyasi `asset-media` bucket'inda tutulur.
- Dashboard, panel health, assets listeleme ve rate limit tarafinda DB yardimci fonksiyonlari kullanilir.

## Operasyonel Sinirlar

- Hosting hedefi repo icinde tanimli degil.
- Edge Function schedule'lari manuel kurulum ister.
- Backup, restore, domain ve TLS dogrulamasi repo disi operasyondur.
