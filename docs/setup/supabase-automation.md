# Supabase Automation (Trigger + Action)

Bu setup ile su trigger'lar event uretir:
- `warranty_30_days` (`assets.warranty_end_date = current_date + 30`)
- `maintenance_7_days` (`maintenance_rules.next_due_date = current_date + 7`)
- `service_log_created` (`service_logs` insert sonrasi)

Bu event'ler su action'lari calistirir:
- `email`
- `push_notification` (geriye uyumlu olarak `push` de desteklenir)
- `pdf_report`

## 1) SQL migration

Supabase SQL Editor'da calistirin:

`supabase/migrations/20260216130000_automation_events.sql`
`supabase/migrations/20260218150000_notification_flow_cron_due_and_rule_crud.sql`

Not:
- Migration, due event taramasini cron penceresine uyumlu sekilde calistirir.
- `automation_events.dedupe_key` ve `on conflict do nothing` ile tekilleme korunur.

## 2) Edge Function deploy

```bash
supabase functions deploy automation-dispatcher
```

Dosya:
- `supabase/functions/automation-dispatcher/index.ts`

## 3) Function secret'lari

```bash
supabase secrets set AUTOMATION_CRON_SECRET=CHANGE_ME
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set AUTOMATION_FROM_EMAIL=no-reply@your-domain.com
supabase secrets set EXPO_ACCESS_TOKEN=YOUR_EXPO_TOKEN
```

## 4) Dispatcher schedule (Supabase event)

Secenek A (onerilen): Supabase Dashboard > Edge Functions > Schedules ile
`automation-dispatcher` function'ini `* * * * *` cron ile her dakika calistirin.
Dispatcher cagrisi `emit_due_automation_events` fonksiyonunu da tetikleyebilir:

```json
{
  "batch_size": 25,
  "emit_due_events": true,
  "due_window": "1 day"
}
```

Secenek B (`pg_cron + pg_net`):

```sql
create extension if not exists pg_net;

select cron.schedule(
  'automation_dispatcher_every_minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/automation-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-cron-secret', '<AUTOMATION_CRON_SECRET>'
    ),
    body := jsonb_build_object('batch_size', 25)
  );
  $$
);
```

## 5) Push token kaydı (client snippet)

```ts
await supabase.from("push_subscriptions").upsert({
  user_id: user.id,
  token: expoPushToken,
  platform: "ios",
  is_active: true,
});
```

