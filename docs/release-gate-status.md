# Release Gate Status (checkpoint) - 2026-03-03

## Yapılanlar
- Node 20 LTS sabitlendi (engines + .nvmrc + .node-version + engine-strict)
- Dev Turbopack kapalı (next dev --webpack)
- Eksik deps kuruldu: @supabase/ssr, @opentelemetry/api
- Playwright config: testDir ./tests, artifacts output, trace retain-on-failure
- Runner eklendi: scripts/run-rls-negative-playwright.mjs
- RLS negative test çalışıyor (artefact üretiyor)

## Mevcut Fail
- testsprite/tests/rls/rls-negative.spec.ts FAIL:
  Missing required env var: NEXT_PUBLIC_SUPABASE_URL
  Kaynak: testsprite/tests/e2e/helpers/supabase-admin.ts: must()

## Kalanlar (kritik)
- .env.local veya CI secrets içinde NEXT_PUBLIC_SUPABASE_URL + (muhtemelen) SUPABASE_SERVICE_ROLE_KEY setlemek
- RLS negative test tekrar koşturmak ve PASS görmek
- CI secret scan (gitleaks) job'unu tek workflow içinde finalize etmek
- Stripe test->prod key ayrımı kontrol
- Rate-limit abuse testi + 429 doğrulaması


