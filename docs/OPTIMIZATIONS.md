### 1) Optimization Summary

- Current optimization health: **moderate risk**. Core features work, but multiple hot paths pull large datasets and compute aggregates in app code instead of the database.
- Top 3 highest-impact improvements:
  1. Move dashboard/panel aggregations to SQL-side aggregates (or RPC/materialized views) and reduce row payloads.
  2. Decouple `/api/service-media` AI enrichment from request-response path (async job + strict timeouts + bounded concurrency).
  3. Add pagination/filter-driven queries for Services/Reports/Assets pages instead of loading full user history.
- Biggest risk if no changes are made: latency and infra/API cost will rise non-linearly with tenant data growth, eventually causing timeouts and poor UX on heavy accounts.

### 2) Findings (Prioritized)

- **Title**: Synchronous media upload + AI enrichment in one request path
- **Category**: Network / Reliability / Cost
- **Severity**: Critical
- **Impact**: Lower p95/p99 latency, fewer timeouts, lower OpenAI cost spikes, better throughput.
- **Evidence**: `src/app/api/service-media/route.ts:714` (sequential upload+insert loop), `:785`, `:790`, `:795`, `:813` (AI calls executed serially), `:302`, `:334` (external OpenAI HTTP calls), `:360` (full image base64 in memory), no timeout/abort guard in file.
- **Classification**: Over-Abstracted Code
- **Why it's inefficient**: Request does storage I/O + DB writes + multiple external AI calls synchronously; one slow external call delays entire endpoint. Base64 conversion inflates memory for large images.
- **Recommended fix**: Return fast after media persistence, enqueue AI enrichment job (queue/cron worker). Add per-call timeout (e.g., 8-15s) with retry budget and jitter. Use bounded parallelism for multi-file uploads (2-3 concurrent).
- **Tradeoffs / Risks**: Adds async job infra and eventual consistency for AI notes.
- **Expected impact estimate**: High; likely **40-70% lower p95** for media endpoint and fewer timeout failures under load.
- **Removal Safety**: Needs Verification
- **Reuse Scope**: Service-wide

- **Title**: Dashboard snapshot over-fetches rows and aggregates in Node
- **Category**: DB / Algorithm / Cost
- **Severity**: High
- **Impact**: Faster dashboard load, lower DB egress, lower server CPU/memory.
- **Evidence**: `src/features/dashboard/api/dashboard-queries.ts:576-601` (multiple broad queries, including `limit(1000)` logs and `limit(5000)` docs), `:708-752` (repeated in-memory range scans and reductions).
- **Classification**: Over-Abstracted Code
- **Why it's inefficient**: Pulls large row sets to app tier, then performs multiple passes (count/sum/filter/sort). This duplicates work the DB can do faster with indexes and aggregate operators.
- **Recommended fix**: Replace with SQL/RPC that returns pre-aggregated metrics and only top-N risk/activity rows; fetch only columns needed for visible cards.
- **Tradeoffs / Risks**: More SQL complexity and migration/versioning overhead.
- **Expected impact estimate**: High; likely **30-60% less payload** and noticeable dashboard TTFB reduction.
- **Removal Safety**: Likely Safe
- **Reuse Scope**: Service-wide

- **Title**: Panel health endpoint performs full-table user scans each request
- **Category**: DB / Cost
- **Severity**: High
- **Impact**: Lower DB read load and endpoint latency.
- **Evidence**: `src/app/api/panel-health/route.ts:110-116` (`assets select("*")` + full reads from rules/logs/docs/expenses/invoices), plus in-memory reductions/loops at `:133-148`, `:168`, `:215`.
- **Classification**: Over-Abstracted Code
- **Why it's inefficient**: Unbounded reads scale with account size; `select("*")` inflates transfer and memory.
- **Recommended fix**: Use SQL aggregates (`count`, `sum`, grouped counts) and targeted top-N queries. Replace `select("*")` with explicit columns.
- **Tradeoffs / Risks**: Requires careful SQL validation to preserve current score semantics.
- **Expected impact estimate**: High; **significant DB I/O reduction** on medium/large tenants.
- **Removal Safety**: Likely Safe
- **Reuse Scope**: Service-wide

- **Title**: Global dashboard metrics endpoint can scan massive auth user pages
- **Category**: Concurrency / Cost / Reliability
- **Severity**: High
- **Impact**: Prevents expensive periodic spikes and keeps metrics endpoint predictable.
- **Evidence**: `src/app/api/dashboard-metrics/route.ts:47-48` (`LIST_USERS_PAGE_SIZE=1000`, `MAX_LIST_USERS_PAGES=200`), `:120-124` (`auth.admin.listUsers` loop), fallback health calc reads wide datasets at `:243-251`, plus full health_score read at `:322-335`.
- **Classification**: Over-Abstracted Code
- **Why it's inefficient**: On global scope, endpoint may traverse very large user pages and compute health on demand.
- **Recommended fix**: Precompute global metrics on schedule (materialized table/cache with TTL). Serve API from cached snapshot; trigger async recompute.
- **Tradeoffs / Risks**: Metrics become near-real-time (not strictly real-time).
- **Expected impact estimate**: High; **order-of-magnitude cost reduction** for repeated metrics requests.
- **Removal Safety**: Needs Verification
- **Reuse Scope**: Service-wide

- **Title**: Frontend pages load full history then filter client-side (no pagination)
- **Category**: Frontend / Network / DB
- **Severity**: High
- **Impact**: Faster page load, reduced browser memory, better mobile performance.
- **Evidence**:
  - Services page loads all logs then filters in browser: `src/features/services/containers/services-page-container.tsx:90`, `:239-254`.
  - Reports page loads all services/docs then slices by date in browser: `src/features/reports/containers/reports-page-container.tsx:119-120`, `:162`, `:172`, `:182`, `:207`.
  - Assets metrics queries pull all matching per asset set and sign URLs in batch: `src/features/assets/containers/assets-page-container.tsx:284-303`, `:415-421`.
- **Classification**: Over-Abstracted Code
- **Why it's inefficient**: Data transfer and client compute scale with total historical rows, not visible rows.
- **Recommended fix**: Server-side filtering + pagination/infinite scroll; request only visible ranges and counts.
- **Tradeoffs / Risks**: More API/state complexity (cursor/page management).
- **Expected impact estimate**: High on larger datasets; **substantial initial render improvements**.
- **Removal Safety**: Needs Verification
- **Reuse Scope**: Service-wide

- **Title**: Plan resolution does extra write/read on many requests
- **Category**: DB / Cost / Reliability
- **Severity**: Medium
- **Impact**: Fewer DB roundtrips and write contention.
- **Evidence**: `src/lib/supabase/route-auth.ts:69` (`getOrCreateProfilePlan` on auth), `src/lib/plans/profile-plan.ts:121-127` (`upsert` then `select`), PlanContext repeats profile ensure + 4 count queries at `src/contexts/PlanContext.tsx:95`, `:113-117`; many routes call `requireRouteUser` (`src/app/api/...` multiple hits).
- **Classification**: Over-Abstracted Code
- **Why it's inefficient**: Ensuring profile via upsert+read in hot auth path adds avoidable DB load for every protected request.
- **Recommended fix**: Create profile once on signup/login trigger; in request path only read plan (or trust cached metadata with periodic reconciliation).
- **Tradeoffs / Risks**: Needs migration-safe fallback if profile row missing.
- **Expected impact estimate**: Medium; **reduces baseline DB chatter** across all APIs.
- **Removal Safety**: Needs Verification
- **Reuse Scope**: Service-wide

- **Title**: Repository aggregates and "latest per rule" computed inefficiently in app layer
- **Category**: DB / Algorithm
- **Severity**: Medium
- **Impact**: Lower CPU and transfer for common analytics calls.
- **Evidence**: `src/lib/repos/service-logs-repo.ts:214` (select all `cost` rows then aggregate), `:470-481` (fetch all service_dates for rules then dedupe first in JS), `src/lib/repos/documents-repo.ts:168-174` (select all `file_size` rows then reduce).
- **Classification**: Reuse Opportunity
- **Why it's inefficient**: App-side reductions require transferring every matching row and multiple passes.
- **Recommended fix**: Use SQL aggregates (`sum`, `avg`, `count`) and `distinct on (rule_id)` / window functions for latest-per-group.
- **Tradeoffs / Risks**: DB query portability/testing overhead.
- **Expected impact estimate**: Medium; **20-50% lower payload** for aggregate-heavy calls.
- **Removal Safety**: Likely Safe
- **Reuse Scope**: Module

- **Title**: Validation/parsing logic duplicated across API/services
- **Category**: Build / Reliability / Maintainability
- **Severity**: Medium
- **Impact**: Lower bug surface, easier optimization hardening, smaller maintenance cost.
- **Evidence**: Repeated UUID/date/optional-text/file validation patterns in:
  - `src/app/api/assets/route.ts:34-78`
  - `src/app/api/service-logs/route.ts:41-91`
  - `src/app/api/documents/route.ts:15-16`, `:85`, `:136`
  - `src/app/api/service-media/route.ts:16-17`, `:88`, `:504`
  - `src/lib/services/billing-service.ts:67-68`, `:117`, `:144`, `:217`
- **Classification**: Reuse Opportunity
- **Why it's inefficient**: Copy-paste validation drifts over time, causing inconsistent behavior and repeated optimization/security work.
- **Recommended fix**: Centralize parsing/validation primitives in shared module(s), with schema tests and per-route composition.
- **Tradeoffs / Risks**: Initial refactor touches many files.
- **Expected impact estimate**: Medium (engineering velocity + defect reduction), low direct runtime gain.
- **Removal Safety**: Needs Verification
- **Reuse Scope**: Service-wide

- **Title**: Parallel legal content trees likely increase maintenance overhead
- **Category**: Build / Maintainability
- **Severity**: Low
- **Impact**: Smaller maintenance surface, less content drift risk.
- **Evidence**: Two parallel route trees with overlapping legal topics:
  - `src/app/legal/...` (e.g., `privacy`, `terms`, `kvkk`, `security`)
  - `src/app/(legal)/...` (e.g., `privacy`, `terms`, `kvkk`, `security`)
- **Classification**: Dead Code (needs verification)
- **Why it's inefficient**: Similar pages maintained in two trees can drift and increase review/test overhead.
- **Recommended fix**: Keep one canonical legal content source; alias/redirect the other route set.
- **Tradeoffs / Risks**: Must verify SEO and routing intent before removal.
- **Expected impact estimate**: Low runtime gain, medium long-term maintainability gain.
- **Removal Safety**: Needs Verification
- **Reuse Scope**: Module

### 3) Quick Wins (Do First)

- Add request timeouts + retry budget to OpenAI calls in `service-media` and `maintenance-predictions`.
- Replace `select("*")` in panel health with explicit columns.
- Add pagination limits to services/reports list fetches and fetch first page only.
- Move simple sum/count operations to SQL aggregates (`sum(file_size)`, `sum(cost)`, `count(*)`).
- Stop profile `upsert` in hot request path; read-only lookup with fallback.

### 4) Deeper Optimizations (Do Next)

- Introduce a `dashboard_snapshot` RPC/materialized view to compute all dashboard cards/risk panels server-side.
- Build async enrichment pipeline for media AI (queue + worker + idempotency key + status field).
- Create a metrics cache table for global dashboard metrics with scheduled refresh.
- Standardize repository query contracts around cursor pagination and filter objects.
- Consolidate all shared validators/parsers into typed domain validation package.

### 5) Validation Plan

- Benchmarks:
  - Run route benchmarks for `/dashboard`, `/api/panel-health`, `/api/dashboard-metrics`, `/api/service-media` with dataset sizes: small (100 rows), medium (10k), large (100k).
  - Measure p50/p95/p99 latency and response size.
- Profiling strategy:
  - Use Postgres `EXPLAIN (ANALYZE, BUFFERS)` on heavy queries before/after.
  - Capture server CPU/memory per request in local prod mode.
  - Track OpenAI call duration and failure rate with structured logs.
- Metrics to compare before/after:
  - DB rows read, bytes transferred, query time, API p95 latency.
  - OpenAI request count, timeout count, enrichment success rate.
  - Browser memory and first-contentful render time on Services/Reports/Assets pages.
- Correctness tests:
  - Snapshot parity tests for dashboard metrics/risk panels against current implementation.
  - Contract tests for pagination/filter semantics.
  - E2E for media upload flow ensuring eventual AI note enrichment and rollback consistency.

### 6) Optimized Code / Patch (when possible)

- Suggested SQL-side aggregation (pseudo-patch):

```sql
-- Example: replace app-side document size reduction
create or replace function public.sum_documents_size(p_user_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(file_size), 0)::bigint
  from public.documents
  where user_id = p_user_id;
$$;
```

- Suggested latest-per-rule query (pseudo-patch):

```sql
-- Replace listLatestServiceDatesByRules app-side dedupe
select distinct on (rule_id)
  rule_id,
  asset_id,
  service_date
from public.service_logs
where user_id = $1
  and rule_id = any($2)
order by rule_id, service_date desc;
```

- Suggested index additions aligned with current sort patterns (pseudo-patch):

```sql
create index if not exists idx_assets_user_updated_at
  on public.assets(user_id, updated_at desc);

create index if not exists idx_service_logs_user_created_at
  on public.service_logs(user_id, created_at desc);
```

- Suggested timeout wrapper for external AI calls (pseudo-patch):

```ts
async function fetchWithTimeout(input: RequestInfo, init: RequestInit, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

- Suggested async enrichment architecture (pseudo-patch):

```ts
// API returns quickly after persistence
await enqueueMediaEnrichment({ serviceLogId, userId, uploadedDocumentIds });
return NextResponse.json({ ok: true, uploadedCount, enrichment: "queued" }, { status: 202 });
```

