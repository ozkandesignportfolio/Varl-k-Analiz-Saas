import "server-only";

import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import {
  getAdaptiveStalenessWindowMs,
  METRIC,
  emitStructuredLog,
  requestFreshSnapshot,
  setGauge,
  type TelemetrySnapshot,
} from "@/lib/telemetry/event-telemetry";

/**
 * DLQ SNAPSHOTTER (with TTL cache + incremental delta)
 * ============================================================================
 * Reads the current `dead_letter_events` row count via a head-only query
 * (no rows fetched, only the count header). Updates dlq_size_snapshot gauge.
 *
 * Optimizations:
 *   - 30 s TTL cache: repeat calls within the window return the cached value
 *     without hitting the database.
 *   - Incremental delta: callers can adjust the cached count by ±N between
 *     full snapshots (e.g. after inserting / deleting a dead-letter row).
 *
 * Non-intrusive:
 *   - No schema changes
 *   - No writes to the database
 *   - Failures emit a structured log but never throw
 *
 * Intended caller: admin telemetry API route (on-demand) or scheduled cron.
 * ============================================================================
 */

/** Default cache TTL: 30 seconds. */
const DLQ_CACHE_TTL_MS = 30_000;

// ---------------------------------------------------------------------------
// Module-private cache (isolated from other modules)
// ---------------------------------------------------------------------------

type DlqCache = {
  /** Last fetched row count (null = never fetched). */
  cached: number | null;
  /** Timestamp (ms) of the last successful full count query. */
  lastSnapshot: number;
  /** Accumulated delta since last full fetch (±N from incremental updates). */
  delta: number;
};

const DLQ_CACHE_KEY = "__assetly_dlq_cache__";

const ensureFreshSnapshot = (snapshot?: TelemetrySnapshot): TelemetrySnapshot => {
  if (!snapshot || Date.now() - snapshot.snapshotTimestamp > getAdaptiveStalenessWindowMs(snapshot)) {
    return requestFreshSnapshot();
  }
  return snapshot;
};

const getDlqCache = (): DlqCache => {
  const g = globalThis as unknown as Record<string, DlqCache | undefined>;
  if (!g[DLQ_CACHE_KEY] || typeof g[DLQ_CACHE_KEY] !== "object") {
    g[DLQ_CACHE_KEY] = { cached: null, lastSnapshot: 0, delta: 0 };
  }
  return g[DLQ_CACHE_KEY] as DlqCache;
};

// ---------------------------------------------------------------------------
// Full snapshot (with TTL)
// ---------------------------------------------------------------------------

/**
 * Returns the DLQ size. If a fresh value was fetched within the TTL window,
 * returns the cached value + accumulated delta without a DB round-trip.
 *
 * @param forceRefresh  Bypass the TTL cache and always hit the DB.
 */
export const snapshotDlqSize = async (
  forceRefresh = false,
): Promise<number | null> => {
  try {
    const dlq = getDlqCache();

    // Serve from cache if still fresh and not forced.
    if (
      !forceRefresh &&
      dlq.cached !== null &&
      Date.now() - dlq.lastSnapshot < DLQ_CACHE_TTL_MS
    ) {
      const val = Math.max(0, dlq.cached + dlq.delta);
      setGauge(METRIC.DLQ_SIZE_SNAPSHOT, val);
      return val;
    }

    const admin = getSupabaseAdmin();
    const { count, error } = await admin
      .from("dead_letter_events")
      .select("id", { count: "exact", head: true });

    if (error) {
      emitStructuredLog({
        event: "telemetry.dlq_snapshot",
        status: "failure",
        level: "warn",
        meta: { error: error.message },
      });
      // Return stale cached value if available.
      return dlq.cached !== null ? Math.max(0, dlq.cached + dlq.delta) : null;
    }

    const size = count ?? 0;
    // Reset cache: fresh baseline, zero delta.
    dlq.cached = size;
    dlq.lastSnapshot = Date.now();
    dlq.delta = 0;

    setGauge(METRIC.DLQ_SIZE_SNAPSHOT, size);
    emitStructuredLog({
      event: "telemetry.dlq_snapshot",
      status: "success",
      meta: { size, source: "db" },
    });
    return size;
  } catch (err) {
    emitStructuredLog({
      event: "telemetry.dlq_snapshot",
      status: "failure",
      level: "error",
      meta: { error: err instanceof Error ? err.message : String(err) },
    });
    return null;
  }
};

export const __resetDlqCacheForTests = () => {
  const g = globalThis as unknown as Record<string, DlqCache | undefined>;
  g[DLQ_CACHE_KEY] = { cached: null, lastSnapshot: 0, delta: 0 };
};

// ---------------------------------------------------------------------------
// Incremental delta (lightweight, no DB call)
// ---------------------------------------------------------------------------

/**
 * Adjust the cached DLQ count by a delta (+1 after insert, −1 after delete).
 * If no cached baseline exists yet, the delta is accumulated and applied on
 * the next full snapshot.
 *
 * Also updates the gauge immediately so the admin dashboard reflects the
 * change without waiting for the next full refresh.
 *
 * Never throws.
 */
export const incrementDlqDelta = (delta: number): void => {
  try {
    const d = Number.isFinite(delta) ? delta : 0;
    if (d === 0) return;
    const dlq = getDlqCache();
    dlq.delta += d;
    // Update gauge immediately if we have a baseline.
    if (dlq.cached !== null) {
      setGauge(METRIC.DLQ_SIZE_SNAPSHOT, Math.max(0, dlq.cached + dlq.delta));
    }
  } catch {
    // Never crash.
  }
};

/**
 * Returns the current cached DLQ size (baseline + delta) without any I/O.
 * Returns null if no baseline has been fetched yet.
 *
 * If a snapshot is provided, validates freshness first. When stale, requests
 * a fresh snapshot from telemetry and returns the DLQ gauge value from it.
 * Existing callers passing no arguments are unaffected.
 */
export const getCachedDlqSize = (snapshot?: TelemetrySnapshot): number | null => {
  try {
    // Freshness-aware path: cross-reference with telemetry gauge.
    if (snapshot !== undefined) {
      const fresh = ensureFreshSnapshot(snapshot);
      const gauge = fresh.gauges.find((g) => g.name === METRIC.DLQ_SIZE_SNAPSHOT);
      if (gauge) return gauge.value;
    }
    // Fallback: local cache only.
    const dlq = getDlqCache();
    if (dlq.cached === null) return null;
    return Math.max(0, dlq.cached + dlq.delta);
  } catch {
    return null;
  }
};
