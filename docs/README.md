# AssetCare Docs

Bu klasor, repo icinde dogrulanabilen urun, mimari, guvenlik ve kurulum notlarini toplar.

Kodla dogrulanamayan operasyonel basliklar ilgili dosyalarda `manual verification` olarak isaretlenmistir.

## Hızlı Yönlendirme

- Urun kapsamı: [PRD.md](./PRD.md)
- Mimari ozet: [architecture.md](./architecture.md)
- Guvenlik modeli: [security.md](./security.md)
- Release durumu: [release-gate-status.md](./release-gate-status.md)
- Yakın donem isler: [TRACKING_TODO.md](./TRACKING_TODO.md)

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
