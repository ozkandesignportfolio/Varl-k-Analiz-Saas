# Event Telemetry Layer

Non-intrusive telemetry for the notification event system. Adds metrics,
structured logs, and alert hooks **without modifying any existing function
signatures** or business logic.

## Modules

| File | Purpose |
|------|---------|
| `event-telemetry.ts` | Public API: `incrementCounter`, `recordLatency`, `emitStructuredLog`, `setGauge`, `getTelemetrySnapshot` |
| `wrap-with-telemetry.ts` | Generic decorator `wrapWithTelemetry(fn, options)` + `wrapDispatcher` / `wrapRetryHandler` factories |
| `alert-hooks.ts` | `evaluateAlerts`, `dispatchAlerts` (fire-and-forget webhook), `evaluateAndDispatchAlerts`, `getActiveAlerts` |
| `dlq-snapshot.ts` | `snapshotDlqSize()` — head-only count query against `dead_letter_events` |

## Metrics Tracked

- `event_dispatch_success_total` (counter)
- `event_dispatch_failure_total` (counter)
- `notification_retry_count` (counter)
- `notification_latency_ms` (histogram: count / sum / min / max / p50 / p95)
- `dlq_size_snapshot` (gauge with rolling history for growth detection)

## Structured Log Format

Every log line is a single JSON object on stdout:

```json
{
  "timestamp": "2026-04-19T08:00:00.000Z",
  "level": "info",
  "event": "notification.dispatch",
  "status": "success",
  "latency_ms": 42,
  "entity_id": "evt_abc123",
  "meta": { "...": "..." }
}
```

Logs are emitted via `queueMicrotask` so the caller is never blocked.

## Wrapping Existing Emitters (Opt-In, No Source Modification)

At the call site (NOT inside the emitter):

```ts
import { wrapDispatcher } from "@/lib/telemetry/wrap-with-telemetry";
import { dispatchWithMetrics } from "@/lib/notifications/dispatch/dispatch-executor";

const dispatch = wrapDispatcher(
  dispatchWithMetrics,
  (_args, result) => (result && "eventId" in result ? result.eventId ?? null : null),
  (result) => result && "ok" in result && result.ok === false,
);

await dispatch(adminClient, event, context);
```

The original `dispatchWithMetrics` is untouched. The wrapper:

1. Measures latency.
2. Increments success / failure counters.
3. Records latency histogram.
4. Emits a structured log (fire-and-forget).
5. Re-throws any exception unchanged.

## Alerts

Triggered on:

- **Failure rate > 5%** (configurable; minimum 20 dispatches to avoid noise)
- **Retry count spike** (Δ ≥ 25 per evaluation; configurable)
- **DLQ growing** (3 consecutive non-decreasing gauge samples)

Delivery: `ALERT_WEBHOOK_URL` (JSON POST) if set; otherwise logged and
exposed via the admin API. All network I/O is detached.

## Admin Consumption

`GET /api/admin/telemetry` → returns `{ snapshot, alerts, dlqSize }`.
`POST /api/admin/telemetry` → re-samples DLQ, re-evaluates alerts, returns
the same payload.

Any existing admin dashboard can fetch this endpoint; **no UI components
need to change**.

## Environment

```
ADMIN_DASHBOARD_SECRET=...        # already used for admin API auth
ALERT_WEBHOOK_URL=                # optional; JSON POST sink for alerts
```
