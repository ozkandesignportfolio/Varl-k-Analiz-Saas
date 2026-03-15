# Supabase Bağlantısı

## 1) Environment dosyasi
`.env.local` oluşturup aşağıdaki alanları doldurun:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

## 2) Supabase client katmani
- Browser client: `src/lib/supabase/client.ts`
- Server client: `src/lib/supabase/server.ts`

## 3) Ilk migration
`supabase/migrations/20260215183000_init.sql` dosyasini SQL Editor'da calistirin.
Ardindan storage policy migrationi calistirin:
`supabase/migrations/20260215183500_storage.sql`
Ardindan abonelik talep tablosu migrationini calistirin:
`supabase/migrations/20260215193000_subscription_requests.sql`
Ardindan audit log tablosu ve trigger migrationini calistirin:
`supabase/migrations/20260216124500_audit_logs.sql`
Yeni premium medya ozelligi icin su migrationi da calistirin:
`supabase/migrations/20260222153000_asset_media_premium_uploads.sql`
Dashboard snapshot RPC icin su migrationi da calistirin:
`supabase/migrations/20260228150000_dashboard_snapshot_rpc.sql`
Dashboard snapshot RPC overload cakismasini temizlemek icin su migrationi da calistirin:
`supabase/migrations/20260228155000_dashboard_snapshot_rpc_remove_ambiguous_overload.sql`
Assets satin alma fiyati kolonu icin su migrationi da calistirin:
`supabase/migrations/202603150001_assets_purchase_price.sql`

Not: `public.asset_media` tablosu olusmadiginda Supabase sorgulari
"Could not find the table 'public.asset_media' in the schema cache" hatasi dondurebilir.
Not: Dashboard migrationlari eksikse su hata dondurebilir:
"Could not find the function public.get_dashboard_snapshot(p_from, p_to, p_user_id) in the schema cache"
Not: Asagidaki hata varsa overload cakismasi vardir:
"Could not choose the best candidate function between: public.get_dashboard_snapshot(...)"
Not: Asagidaki hata varsa assets tablosunda satin alma fiyati kolonu eksiktir:
"column assets.purchase_price does not exist"

## 4) Private bucket
- Bucket adı: `documents-private`
- Dosya path: `<user_id>/<asset_id>/<filename>`

## 5) Landing abonelik API
- Endpoint: `POST /api/subscription-request`
- Bu endpoint `SUPABASE_SERVICE_ROLE_KEY` kullanarak
  `subscription_requests` tablosuna talep kaydı acar.

## 6) Otomasyon (trigger + action)
- SQL migration: `supabase/migrations/20260216130000_automation_events.sql`
- Kurulum ve schedule notlari: `docs/setup/supabase-automation.md`
