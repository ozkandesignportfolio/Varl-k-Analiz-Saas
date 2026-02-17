# AssetCare

Ev ve varliklarin bakim, garanti, servis ve belge sureclerini yonetmek icin gelistirilen SaaS paneli.

## Tech Stack
- Next.js (App Router) + React
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage)
- Chart.js
- jsPDF

## Kurulum
1. Bagimliliklari kur:
```bash
npm install
```

2. Ortam degiskenlerini hazirla:
```bash
cp .env.example .env.local
```
`.env.local` icine Supabase degerlerini gir.

3. Gelistirme sunucusunu calistir:
```bash
npm run dev
```

## Klasor Yapisi
```text
docs/
  PRD.md
  setup/
.github/workflows/
supabase/
  migrations/
src/
  app/
  components/
  features/
  lib/
  types/
```

## Supabase ve GitHub Baglanti Notlari
- Supabase: `docs/setup/supabase.md`
- GitHub: `docs/setup/github.md`

## CI
Push ve PR durumunda lint + build calistiran pipeline:
- `.github/workflows/ci.yml`

