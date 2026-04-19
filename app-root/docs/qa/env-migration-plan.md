# Env Migration Plan (Process Env Audit)

## Scope
- Full repository audit with `scripts/audit-process-env.mjs`
- Includes `scripts/`, `tests/`, `src/`, config files
- Excludes `node_modules`, `.next`, `.git`

## Strategy
1. Run audit script and persist report to `docs/qa/process-env-audit.json`.
2. Categorize findings by layer:
   - `src/` app/runtime code (must migrate to `ServerEnv/PublicEnv/BuildEnv`)
   - `instrumentation.ts` (allowed deterministic runtime branching)
   - `src/lib/env/*` (allowed env boundary layer)
   - `scripts/tests` (keep explicit and isolated)
3. Prioritize by production risk:
   - Secret-bearing server code
   - Runtime boundary files
   - Build/runtime shared modules
4. Apply migration in small batches and run:
   - `npx tsc --noEmit`
   - `npx next build`
5. Enforce regression lock through ESLint (`no-restricted-properties` for `process.env` on `src/**`).

## Completion Criteria
- No direct `process.env` in `src/**` except env layer and instrumentation runtime gate.
- Build + typecheck stable.
- Audit report generated and reviewed.
