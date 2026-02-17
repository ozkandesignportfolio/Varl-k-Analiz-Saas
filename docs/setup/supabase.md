# Supabase Baglantisi

## 1) Environment dosyasi
`.env.local` olusturup asagidaki alanlari doldurun:
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

## 4) Private bucket
- Bucket adi: `documents-private`
- Dosya path: `<user_id>/<asset_id>/<filename>`

## 5) Landing abonelik API
- Endpoint: `POST /api/subscription-request`
- Bu endpoint `SUPABASE_SERVICE_ROLE_KEY` kullanarak
  `subscription_requests` tablosuna talep kaydi acar.

## 6) Otomasyon (trigger + action)
- SQL migration: `supabase/migrations/20260216130000_automation_events.sql`
- Kurulum ve schedule notlari: `docs/setup/supabase-automation.md`
