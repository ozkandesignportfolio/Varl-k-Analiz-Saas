# Email Reminder System - Production Documentation

## Overview
Production-grade reminder email system for unverified users. Sends hourly reminders to users who haven't verified their email, with rate limiting (1 reminder per 24 hours per user).

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Vercel Cron    │────▶│  /api/cron/email-    │────▶│  Supabase DB    │
│  (Every hour)   │     │  reminder (Next.js)  │     │  + Resend API   │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Edge Function │ (Backup)
                        │email-reminder │
                        └──────────────┘
```

---

## 1. Database Schema

### Table: `email_reminder_logs`

```sql
CREATE TABLE public.email_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    reminder_type VARCHAR(50) NOT NULL DEFAULT 'verification_reminder',
    status VARCHAR(20) NOT NULL CHECK (status IN ('attempt', 'success', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- `idx_email_reminder_logs_user_id` (user_id)
- `idx_email_reminder_logs_sent_at` (sent_at)
- `idx_email_reminder_logs_status` (status)
- `idx_email_reminder_logs_user_sent_at` (user_id, sent_at)

**RLS Policies:**
- Service role: full access
- Authenticated users: no access

---

## 2. SQL Functions

### `find_unverified_users_for_reminder()`

Finds users who need reminder emails based on criteria:

```sql
SELECT * FROM public.find_unverified_users_for_reminder(
    p_min_age_interval := '10 minutes',    -- Users created > 10 min ago
    p_reminder_cooldown := '24 hours',     -- 1 reminder per 24 hours
    p_limit := 100                         -- Max users per batch
);
```

**Conditions:**
- `email_confirmed_at IS NULL` (unverified)
- `created_at > NOW() - p_min_age_interval` (account older than 10 min)
- No reminder sent in last 24 hours (checked via `email_reminder_logs`)

### `log_email_reminder()`

Logs each reminder attempt:

```sql
SELECT public.log_email_reminder(
    p_user_id := 'uuid',
    p_email := 'user@example.com',
    p_reminder_type := 'verification_reminder',
    p_status := 'attempt|success|failed',
    p_error_message := NULL
);
```

---

## 3. Cron Setup

### Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/email-reminder",
      "schedule": "0 * * * *"
    }
  ]
}
```

Runs every hour at minute 0.

### Alternative: Supabase pg_cron

```sql
SELECT cron.schedule(
    'email-reminder-hourly',
    '0 * * * *',
    'SELECT public.invoke_email_reminder_cron()'
);
```

---

## 4. Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) | `eyJ...` |
| `EMAIL_REMINDER_CRON_SECRET` | Secret for cron authentication | `change_me_email_reminder` |
| `RESEND_API_KEY` | Resend API key | `re_xxx` |
| `AUTOMATION_FROM_EMAIL` | From email address | `no-reply@assetly.network` |

### Vercel-Specific

| Variable | Description |
|----------|-------------|
| `CRON_SECRET` | Must match `EMAIL_REMINDER_CRON_SECRET` for Vercel Cron signature verification |

---

## 5. API Route: `/api/cron/email-reminder`

### Authentication

Requires header: `x-cron-secret: <EMAIL_REMINDER_CRON_SECRET>`

### Request Body (optional)

```json
{
  "batch_size": 50,           // 1-500, default 50
  "min_age_interval": "10 minutes",  // Default: 10 minutes
  "cooldown_interval": "24 hours",   // Default: 24 hours
  "dry_run": false            // If true, returns users without sending
}
```

### Response

```json
{
  "processed": 10,
  "success": 9,
  "failed": 1,
  "duration_ms": 5234,
  "users": [
    {
      "user_id": "uuid",
      "email": "user@example.com",
      "status": "success"
    }
  ]
}
```

---

## 6. Edge Function: `email-reminder`

### Deployment

```bash
supabase functions deploy email-reminder
```

### Invocation

```bash
# Direct invocation
curl -X POST https://<project>.supabase.co/functions/v1/email-reminder \
  -H "x-cron-secret: <secret>" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 50}'

# Via Supabase CLI
supabase functions invoke email-reminder --data '{"batch_size": 50}'
```

---

## 7. Logging & Monitoring

### Structured Logs

All events emit JSON logs:

```json
// Job start
{"event": "EMAIL_REMINDER_CRON_START", "ts": "2026-04-12T11:00:00Z", ...}

// Attempt
{"event": "EMAIL_REMINDER_ATTEMPT", "user_id": "...", "email": "...", "ts": "..."}

// Success
{"event": "EMAIL_REMINDER_SUCCESS", "user_id": "...", "log_id": "...", "duration_ms": 1234}

// Failed
{"event": "EMAIL_REMINDER_FAILED", "user_id": "...", "error": "...", "duration_ms": 1234}

// Job complete
{"event": "EMAIL_REMINDER_CRON_COMPLETE", "summary": {"processed": 10, "success": 9, "failed": 1}}

// Error
{"event": "EMAIL_REMINDER_CRON_ERROR", "error": "..."}
```

### Database Stats

```sql
SELECT * FROM public.get_email_reminder_stats(
    p_since := NOW() - INTERVAL '24 hours'
);
-- Returns: total_attempts, total_success, total_failed, unique_users
```

### Monitoring Query

```sql
-- Recent failures
SELECT email, status, error_message, sent_at
FROM email_reminder_logs
WHERE status = 'failed'
  AND sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

---

## 8. Rate Limiting

- **Per-user cooldown**: 24 hours between reminders
- **Batch size**: Max 500 users per run (default 50)
- **Account age**: Only users created > 10 minutes ago

---

## 9. Email Link Format

**Fixed URL:** `https://www.assetly.network/auth/callback`

This URL is hardcoded in both the API route and edge function to ensure consistency.

---

## 10. Error Handling

### Retries
- No automatic retry for failed sends
- Failed attempts are logged with error messages
- Next cron run will retry after cooldown period

### Common Errors
- `RESEND_API_KEY not configured` → Check env vars
- `Invalid cron secret` → Verify `x-cron-secret` header
- `Missing required configuration` → Check all env vars are set

---

## 11. Security Considerations

1. **Service Role Key**: Never expose to client-side code
2. **Cron Secret**: Use strong random value, rotate regularly
3. **Rate Limiting**: Prevents spam/abuse
4. **RLS**: Only service role can access reminder logs
5. **Email Validation**: Uses Resend API for delivery

---

## 12. Testing

### Dry Run

```bash
curl -X POST https://<your-domain>/api/cron/email-reminder \
  -H "x-cron-secret: <secret>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "batch_size": 10}'
```

### Manual Trigger

```bash
# Local
curl -X POST http://localhost:3000/api/cron/email-reminder \
  -H "x-cron-secret: local_secret" \
  -H "Content-Type: application/json"
```

---

## 13. File Locations

| Component | Path |
|-----------|------|
| SQL Migration (tables/functions) | `supabase/migrations/20260412140000_email_reminder_system.sql` |
| SQL Migration (cron) | `supabase/migrations/20260412141000_email_reminder_cron_schedule.sql` |
| Next.js API Route | `src/app/api/cron/email-reminder/route.ts` |
| Edge Function | `supabase/functions/email-reminder/index.ts` |
| Vercel Config | `vercel.json` |
| Env Example | `.env.example` |
| This Documentation | `docs/setup/EMAIL_REMINDER_SYSTEM.md` |

---

## 14. Deployment Checklist

- [ ] Run SQL migrations in Supabase
- [ ] Set all environment variables in Vercel
- [ ] Verify `EMAIL_REMINDER_CRON_SECRET` matches `CRON_SECRET`
- [ ] Deploy edge function (if using Supabase cron)
- [ ] Test dry run locally
- [ ] Check Resend API key is valid
- [ ] Verify `AUTOMATION_FROM_EMAIL` domain is verified in Resend
- [ ] Monitor first few cron runs for errors
