# Security Overview

Bu belge, repo icinde dogrulanabilen guvenlik modelini ozetler.

## Kimlik Dogrulama

- Korumali sayfalar middleware ile korunur.
- API route'lari `requireRouteUser` kullanir.
- Dogrulanmamis e-posta ile korumali sayfa ve API erisimi engellenir.
- Bearer token ile API erisimi desteklenir, ayni kullanici kontrolunden gecer.

## RLS ve Veri Izolasyonu

RLS kullanilan ana tablolar:

- `assets`
- `maintenance_rules`
- `service_logs`
- `documents`
- `expenses`
- `billing_subscriptions`
- `billing_invoices`
- `profiles`
- `audit_logs`
- `automation_events`
- `push_subscriptions`
- `dismissed_alerts`
- `media_enrichment_jobs`

Ek notlar:

- `subscription_requests` kayit talebi akisina ayridir.
- Cache ve worker odakli bazi tablolar `service_role` erisimi bekler.

## Storage Guvenligi

- Dokuman bucket'i: `documents-private`
- Beklenen path: `<user_id>/<asset_id>/<filename>`
- Varlik medya bucket'i: `asset-media`
- Beklenen path: `<org_id>/<user_id>/<asset_id>/<type>/<file>`

## Rate Limit

- Basit API limitleri icin memory fallback vardir.
- Esas servis limitleri DB RPC ile uygulanir.
- Testte `RATE_LIMIT_STRICT_IN_TEST=1` ile fallback kapatilabilir.

## Secret ve Entegrasyon Koruması

- `SUPABASE_SERVICE_ROLE_KEY` server-side akislarla sinirlidir.
- Stripe secret key canli/test ayrimi ile dogrulanir.
- Stripe webhook imza kontrolu ve event tekillestirme uygular.
- `SERVICE_MEDIA_JOB_SECRET` olmadan worker trigger calismaz.
- Panel health detay gorunumu `PANEL_HEALTH_SECRET` ile sinirlanabilir.

## Repo Icinde Gorulen Sertlestirmeler

- Plan limitleri backend seviyesinde enforce edilir.
- Billing schema eksikse kontrollu disable yaniti donulur.
- `anon/public` yetkilerini daraltan migrationlar vardir.
- Storage policy'leri `authenticated` rolune daraltilmistir.

## Manual Verification Gerekenler

- Supabase backup/PITR aktifligi
- Restore tatbikati
- Production Sentry ayarlari ve alarm rotalari
- Stripe webhook endpoint ve secret eslesmesi
- Edge Function deploy ve cron kurulumlari
- Hosting tarafindaki WAF, TLS ve log retention ayarlari

## Pratik Riskler

- Migration drift olursa RPC ve schema cache hatalari cikabilir.
- Backup/restore prove edilmeden tam launch guveni saglanmis sayilmaz.
