# Assetly

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

## Test Ortami Hazirligi (Teklif)
- `.env.test.example` dosyasini `.env.test` olarak kopyalayin:
```bash
cp .env.test.example .env.test
```
- Test için tercih edilen env dosyasını seçin:
```powershell
$env:TEST_ENV_FILE=".env.test"
```
- Test modunda deterministik davranış için:
```text
APP_ENV=test
NODE_ENV=test
RATE_LIMIT_STRICT_IN_TEST=1
AUTH_FORCE_PROFILE_FROM_DB=1
```

3. Gelistirme sunucusunu calistir:
```bash
npm run dev
```

## Stable Testleri Lokal Calistirma
### 1) Quick Local Run (dev - 3100)
1. Supabase test hesaplarini hazirla (veya `.env.test`'teki kullanıcıları kullan):
- `trial` kullanici: `TRIAL_EMAIL` / `TRIAL_PASSWORD`, `plan=free`
- `premium` kullanici: `PREMIUM_EMAIL` / `PREMIUM_PASSWORD`, `plan=premium`

2. Test env degiskenlerini ayarla:
```powershell
$env:TEST_ENV_FILE=".env.test"
```
Not: `TEST_BASE_URL` opsiyoneldir; ayarlanmazsa varsayilan olarak `http://localhost:3100` kullanilir.

3. Uygulamayi development modda 3100 portunda baslat:
```bash
npm run dev -- --hostname 127.0.0.1 --port 3100
```

4. Ayri bir terminalde seed + stable suite'i calistir:
```bash
npm run test:seed
npm run test:stable
```

### 2) Release Verification Run (build + start - 3100)
1. Ayni `.env.test` ayarlarını kullan:
```powershell
$env:TEST_ENV_FILE=".env.test"
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
npm run test:seed
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
- `TRIAL_EMAIL`, `TRIAL_PASSWORD`, `PREMIUM_EMAIL`, `PREMIUM_PASSWORD` (stabil suite için)
- `TEST_ENV_FILE=.env.test` (opsiyonel, önerilir)
- `RATE_LIMIT_STRICT_IN_TEST=1`, `AUTH_FORCE_PROFILE_FROM_DB=1` (opsiyonel, deterministik)

Opsiyonel RLS seed kullanıcı bilgileri:
- `E2E_RLS_USER_A_EMAIL`, `E2E_RLS_USER_A_PASSWORD`
- `E2E_RLS_USER_B_EMAIL`, `E2E_RLS_USER_B_PASSWORD`

Raporlar:
- `testsprite/testsprite_tests/generated/stable_full_suite_report.trial.json`
- `testsprite/testsprite_tests/generated/stable_full_suite_report.premium.json`

## RLS Negative Test (Playwright)
Komut:
```bash
npm run test:rls:negative
```

Zorunlu env degiskenleri:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENV=test`, `NODE_ENV=test` (öneri)

Opsiyonel:
- `PLAYWRIGHT_BASE_URL` (varsayilan: `http://127.0.0.1:3000`)
- `TEST_BASE_URL` (`PLAYWRIGHT_BASE_URL` yoksa fallback)

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
