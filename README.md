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

## Stable Testleri Lokal Calistirma
### 1) Quick Local Run (dev - 3100)
1. Supabase test hesaplarini hazirla:
- `trial` kullanici (non-premium): `public.profiles.plan = 'free'`
- `premium` kullanici: `public.profiles.plan = 'premium'`

2. Test env degiskenlerini ayarla (PowerShell):
```powershell
$env:TEST_BASE_URL="http://localhost:3100"
$env:TRIAL_EMAIL="trial-user@example.com"
$env:TRIAL_PASSWORD="trial-password"
$env:PREMIUM_EMAIL="premium-user@example.com"
$env:PREMIUM_PASSWORD="premium-password"
```
Not: `TEST_BASE_URL` opsiyoneldir; ayarlanmazsa varsayilan olarak `http://localhost:3100` kullanilir.

3. Uygulamayi development modda 3100 portunda baslat:
```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
```

4. Ayri bir terminalde stable suite'i calistir:
```bash
npm run test:stable
```

### 2) Release Verification Run (build + start - 3100)
1. Ayni test env degiskenlerini kullan:
```powershell
$env:TEST_BASE_URL="http://localhost:3100"
$env:TRIAL_EMAIL="trial-user@example.com"
$env:TRIAL_PASSWORD="trial-password"
$env:PREMIUM_EMAIL="premium-user@example.com"
$env:PREMIUM_PASSWORD="premium-password"
```

2. Uygulamayi build et:
```bash
npm run build
```

3. Uygulamayi production modda 3100 portunda baslat:
```bash
npm run start -- -p 3100
```

4. Ayri bir terminalde stable suite'i calistir:
```bash
npm run test:stable
```

Opsiyonel tekil calistirma:
```bash
npm run test:stable:trial
npm run test:stable:premium
```

## MVP v1.1 Release Gate (Playwright + RLS)
Prod build modunda tum release gate testlerini calistirmak icin:
```bash
npm run test:e2e
```

Bu komut sirasiyla sunlari yapar:
1. `next build` (prod build)
2. Playwright Chromium kurulumu
3. `next start` ile uygulamayi ayaga kaldirma
4. DB seed (`npm run test:seed`)
5. Playwright E2E release gate akislari
6. RLS negatif testleri (`npm run test:rls`)

Gerekli env degiskenleri:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opsiyonel RLS seed kullanıcı bilgileri:
- `E2E_RLS_USER_A_EMAIL`, `E2E_RLS_USER_A_PASSWORD`
- `E2E_RLS_USER_B_EMAIL`, `E2E_RLS_USER_B_PASSWORD`

Raporlar:
- `testsprite_tests/generated/stable_full_suite_report.trial.json`
- `testsprite_tests/generated/stable_full_suite_report.premium.json`

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
Push ve PR durumunda lint + stable test calistiran pipeline:
- `.github/workflows/ci.yml`

## CI Secret Kurulumu
GitHub repository icinde `Settings > Secrets and variables > Actions` altina su secretlari ekleyin:
- `API_KEY`: uygulamanin kullandigi API key
- `TRIAL_EMAIL`: trial test kullanicisinin email'i
- `TRIAL_PASSWORD`: trial test kullanicisinin sifresi
- `PREMIUM_EMAIL`: premium test kullanicisinin email'i
- `PREMIUM_PASSWORD`: premium test kullanicisinin sifresi
