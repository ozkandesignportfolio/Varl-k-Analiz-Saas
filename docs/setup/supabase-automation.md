# Supabase Automation ve Worker Kurulumu

Bu projede iki ayri asenkron yuzey vardir:

- `automation-dispatcher`
- `media-enrichment`

Ana uygulama bunlar olmadan da acilir, fakat otomasyon ve medya enrichment akislarinin bir kismi eksik kalir.

## Gerekli Temel Migrationlar

Tum guncel migrationlar uygulanmalidir. Worker tarafini dogrudan etkileyen gruplar:

- `automation_events`
- `notification_flow_cron_due_and_rule_crud`
- `performance_queue_and_aggregates`
- `media_enrichment_jobs_queue_refactor`

## Deploy Komutlari

```bash
supabase functions deploy automation-dispatcher
supabase functions deploy media-enrichment
```

Kaynak klasorler:

- `supabase/functions/automation-dispatcher`
- `supabase/functions/media-enrichment`

## Secret'lar

### automation-dispatcher

```bash
supabase secrets set AUTOMATION_CRON_SECRET=CHANGE_ME
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set AUTOMATION_FROM_EMAIL=no-reply@your-domain.com
supabase secrets set EXPO_ACCESS_TOKEN=YOUR_EXPO_TOKEN
```

### media-enrichment

- Function runtime icinde `OPENAI_API_KEY` gerekir
- Service role erisimi gerekir
- Uygulama tarafinda `SERVICE_MEDIA_JOB_SECRET` gerekir

## Schedule

Onerilen yol: Supabase Dashboard uzerinden `automation-dispatcher` icin schedule tanimlamak.

Ornek body:

```json
{
  "batch_size": 25,
  "emit_due_events": true,
  "due_window": "1 day"
}
```

## Service Media Job Trigger

`/api/service-media/jobs` endpoint'i:

- `x-job-secret` header'i bekler
- `SERVICE_MEDIA_JOB_SECRET` ile eslesme ister
- DB tabanli service rate limit uygular
- `media-enrichment` function'ini tetikler

## Manual Verification Gerekenler

- Function deploy'leri basarili mi
- Cron aktif mi
- Resend ve Expo secret'lari gecerli mi
- Medya enrichment gercek dosyalarla tamamlanabiliyor mu
