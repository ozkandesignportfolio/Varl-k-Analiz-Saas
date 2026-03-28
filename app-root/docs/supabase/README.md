# Supabase Model Referansi

Bu belge, repoda gorulen Supabase veri modelini yuksek seviyede ozetler.

## Auth ve Plan

- Uygulama Supabase Auth kullanir.
- Korunmali sayfa ve API'ler dogrulanmis kullanici bekler.
- Profil plani `profiles.plan` alaninda `free` veya `premium` olarak tutulur.
- Metadata tarafinda `starter`, `pro` ve `elite` kodlari normalize edilir.

## Ana Tablolar

### Cekirdek uygulama

- `assets`
- `maintenance_rules`
- `service_logs`
- `documents`
- `expenses`
- `audit_logs`

### Billing

- `billing_subscriptions`
- `billing_invoices`
- `profiles`
- `subscription_requests`
- `stripe_webhook_events`

### Otomasyon ve bildirim

- `automation_events`
- `push_subscriptions`
- `dismissed_alerts`

### Performans ve queue

- `media_enrichment_jobs`
- `global_metrics_cache`
- `api_rate_limit_tokens`

## Storage Modeli

### Dokumanlar

- Bucket: `documents-private`
- Path: `<user_id>/<asset_id>/<filename>`

### Varlik medyasi

- Bucket: `asset-media`
- Path: `<org_id>/<user_id>/<asset_id>/<type>/<file>`

## RPC ve Yardimci Katman

Repo, asagidaki turde DB yardimcilari bekler:

- dashboard snapshot
- panel health
- global metrics cache refresh
- assets listeleme ve sayfalama
- API rate limit token alma

## Davranis Notlari

- Billing tabloları eksikse billing API'leri kontrollu sekilde disable olabilir.
- Rate limit, production'da DB agirlikli; testte daha siki davranabilir.
- Migration drift olursa reports, assets, dashboard veya health endpoint'lerinde RPC/schema cache hatalari gorulebilir.

## Manual Verification Gerekenler

- Backup/PITR aktifligi
- Edge Function deploy durumu
- Cron schedule'lar
- Production bucket policy gorunurlugu
