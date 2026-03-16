# Tracking TODO

Bu liste, 2026-03-16 itibariyla repoya gore en yakin teknik ve operasyonel isleri toplar.

## P0

- Production Supabase, Stripe ve Sentry env'lerini dogrula
- `automation-dispatcher` ve `media-enrichment` deploy'unu tamamla
- Backup/PITR ve restore drill yap
- Release oncesi `test:e2e`, `test:rls:negative` ve `test:abuse:rate-limit` sonuclarini guncelle

## P1

- PDF export icin plan kurali ile mevcut UI davranisini hizala
- Stripe webhook akisini canli ortamda uctan uca dogrula
- Panel health secret ve public visibility kararini netlestir
- Stable suite seed hesaplarini staging benzeri ortamda periyodik dogrula

## P2

- Sentry alarm ve ekip bildirim kanalini netlestir
- Edge Function cron izleme ve hata gorunurlugunu operasyonel runbook'a bagla
- Gercek cihaz responsive/PWA turunu tekrar et

## Referans

- Urun kapsami: [PRD.md](./PRD.md)
- Release durumu: [release-gate-status.md](./release-gate-status.md)
- Mimari: [architecture.md](./architecture.md)
