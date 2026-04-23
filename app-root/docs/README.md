# Assetly Docs

Bu klasor, repo icinde dogrulanabilen urun, mimari, guvenlik, operasyon ve kurulum notlarini toplar.

Kodla dogrulanamayan operasyonel basliklar ilgili dosyalarda `manual verification` olarak isaretlenmistir.

## Hizli Yonlendirme

- Urun kapsami: [PRD.md](./PRD.md)
- Mimari ozet: [architecture.md](./architecture.md)
- Guvenlik modeli: [security.md](./security.md)
- Release durumu: [release-gate-status.md](./release-gate-status.md)
- Launch checklist: [launch-checklist.md](./launch-checklist.md)
- Monitoring: [monitoring-guide.md](./monitoring-guide.md)
- Rollback: [rollback-guide.md](./rollback-guide.md)
- Yakin donem isler: [TRACKING_TODO.md](./TRACKING_TODO.md)

## Modul Notlari

- Assets modulu: [assets-module-overview.md](./assets-module-overview.md)
- Billing/subscription/invoice davranisi: [billing-subscription-invoice-behavior.md](./billing-subscription-invoice-behavior.md)

## QA ve Operasyon

- Testing strategy: [qa/testing-strategy.md](./qa/testing-strategy.md)
- Smoke test checklist: [qa/smoke-test-checklist.md](./qa/smoke-test-checklist.md)

## Kurulum

- Lokal gelistirme: [setup/local-development.md](./setup/local-development.md)
- Ortam degiskenleri: [setup/environment.md](./setup/environment.md)
- Supabase kurulumu: [setup/supabase.md](./setup/supabase.md)
- Supabase worker ve otomasyon: [setup/supabase-automation.md](./setup/supabase-automation.md)
- GitHub Actions ve CI: [setup/github.md](./setup/github.md)

## Platform Referansi

- Supabase veri modeli ve storage sinirlari: [supabase/README.md](./supabase/README.md)

## Notlar

- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase, Stripe, Chart.js, jsPDF, Sentry.
- Bu klasor mevcut `docs/`, `docs/setup/` ve `docs/supabase/` yapisini korur.
- `docs/cursor.rules` markdown degildir; bu gorev kapsaminda degistirilmedi.
