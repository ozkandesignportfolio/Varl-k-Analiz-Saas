# Supabase Kurulumu

## Amac

Bu belge, uygulamayi mevcut bir Supabase projesine baglamak icin gereken minimum adimlari ozetler.

## 1. Ortam Degiskenleri

Asgari gereksinim:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

Detayli liste icin [environment.md](./environment.md).

## 2. Migration Kaynagi

Yetkili kaynak `supabase/migrations/*.sql` dosyalaridir.

Kurulum sonrasi en az su alanlarin olusmus olmasi beklenir:

- Cekirdek uygulama tablolari
- `profiles`
- `billing_subscriptions`
- `billing_invoices`
- `documents-private` bucket'i
- `asset-media` bucket'i
- Dashboard, panel health ve rate limit RPC'leri
- `stripe_webhook_events`

## 3. Dogrulama

Kurulumdan sonra:

```bash
npm run build
npm run test:rls:negative
```

SQL tarafinda:

- `supabase/verify_setup.sql`

## 4. Lokal CLI Notu

Repo icinde `supabase/config.toml` vardir. Varsayilan lokal portlar:

- API: `54321`
- DB: `54322`
- Studio: `54323`
- Inbucket: `54324`

Bu gorev kapsaminda migration veya config dosyalari degistirilmedi.

## 5. Ilgili Belgeler

- Supabase model referansi: [../supabase/README.md](../supabase/README.md)
- Worker ve otomasyon: [supabase-automation.md](./supabase-automation.md)
