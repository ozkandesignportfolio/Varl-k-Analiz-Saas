# Supabase Kurulum Notlari

## 1) Proje ayarlari
- Supabase Dashboard'da yeni proje olusturun.
- `Project Settings > API` ekranindan URL ve `anon` key degerlerini alin.
- Degerleri `.env.local` dosyasina yazin (`.env.example` referans).

## 2) SQL migration calistirma
- Sorunsuz kurulum icin tek seferlik script:
  `supabase/migrations/20260215201500_bootstrap_all.sql`
  Ardindan audit log migrationini ayrica calistirin:
  `supabase/migrations/20260216124500_audit_logs.sql`

- Alternatif olarak parca parca:
- Dashboard > SQL Editor ekraninda
  `supabase/migrations/20260215183000_init.sql` dosyasini calistirin.
- Sonra storage policy icin
  `supabase/migrations/20260215183500_storage.sql` dosyasini calistirin.
- Sonra abonelik talep tablosu icin
  `supabase/migrations/20260215193000_subscription_requests.sql` dosyasini calistirin.
- Sonra audit log tablosu + triggerlar icin
  `supabase/migrations/20260216124500_audit_logs.sql` dosyasini calistirin.
- Otomasyon trigger/action motoru icin
  `supabase/migrations/20260216130000_automation_events.sql`
  dosyasini da calistirin.
- Premium medya tablolari/bucket policy'leri icin
  `supabase/migrations/20260222153000_asset_media_premium_uploads.sql`
  dosyasini da calistirin.

Not: Bu migration calismadiysa API tarafinda
"Could not find the table 'public.asset_media' in the schema cache" hatasi alinabilir.

## 2.1) Dogrulama
- Kurulum sonrasi su dosyayi calistirin:
  `supabase/verify_setup.sql`

## 3) Storage bucket
- `documents-private` adinda bucket olusturun.
- Bucket ayarini private yapin.
- Dosya path formati: `<user_id>/<asset_id>/<filename>`

## 4) Otomasyon setup
- Kurulum adimlari icin:
  `docs/setup/supabase-automation.md`
