# GitHub ve CI

## Workflow

Ana CI tanimi `.github/workflows/ci.yml` icindedir.

Tanimli job'lar:

- `gitleaks_scan`
- `lint_build`
- `stable_tests`
- `rls_negative_test`
- `rate_limit_abuse_test`

## Gerekli GitHub Secrets

### Build ve temel testler

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Not:

- `lint_build` bu env'ler eksikse build adimini skip eder.
- RLS ve rate limit job'lari Supabase secret'lari eksikse kendi kendini skip eder.

### Stable suite

- `API_KEY`
- `TRIAL_EMAIL`
- `TRIAL_PASSWORD`
- `PREMIUM_EMAIL`
- `PREMIUM_PASSWORD`

`stable_tests` yalnizca bu secret'lar doluysa calisir.

### Opsiyonel ama faydali

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Bu grup, build sirasinda sourcemap upload kullanilacaksa gerekir.

## Onerilen Yerel Kontroller

PR acmadan once en az su komutlari calistir:

```bash
npm run lint -- --max-warnings=0
npm run build
```

Release oncesi buna ek olarak:

```bash
npm run security:check
npm run test:rls:negative
npm run test:abuse:rate-limit
```

## Not

Repo icinde hosting'e ozel deploy workflow'u yoktur. Deploy pipeline operasyonel olarak ayrica kurulur.
