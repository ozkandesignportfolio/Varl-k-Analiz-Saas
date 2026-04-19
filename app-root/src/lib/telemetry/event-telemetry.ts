import "server-only";
import { Runtime } from "@/lib/env/runtime";

/**
 * EVENT TELEMETRY LAYER (Hardened)
 * ============================================================================
 * Public, non-intrusive API for metrics + structured logs.
 *
 * Hardening guarantees:
 *   - Singleton factory: lazy, idempotent, HMR/dup-import safe.
 *   - Sliding-window aggregation (1m / 5m / 1h) without external deps.
 *   - Metric sanitization: no NaN, no negative counters, latency clamped 0–60s.
 *   - Total safety: writes NEVER throw; all failures degrade to console.warn.
 *   - Non-blocking: zero I/O on the caller's stack (logs via queueMicrotask).
 *
 * Backward compatible public API (unchanged signatures):
 *   - incrementCounter(name, tags?, value?)
 *   - recordLatency(name, ms, tags?)
 *   - emitStructuredLog(event)
 *   - setGauge(name, value, tags?)
 *   - getTelemetrySnapshot()
 *
 * New additive API:
 *   - createTelemetryRegistry()   — singleton factory (idempotent)
 *   - sanitizeMetric(value)
 *   - clampLatency(ms)
 *   - getWindowedSnapshot(windowMs?)
 * ============================================================================
 */

const isBuildPhase = (): boolean =>
  Runtime.isBuild() && !Runtime.isClient() && !Runtime.isServer() && !Runtime.isEdge();

// ---------------------------------------------------------------------------
// Metric names (canonical — consumed by admin dashboard + alerts)
// ---------------------------------------------------------------------------
export const METRIC = {
  EVENT_DISPATCH_SUCCESS_TOTAL: "event_dispatch_success_total",
  EVENT_DISPATCH_FAILURE_TOTAL: "event_dispatch_failure_total",
  NOTIFICATION_RETRY_COUNT: "notification_retry_count",
  NOTIFICATION_LATENCY_MS: "notification_latency_ms",
  DLQ_SIZE_SNAPSHOT: "dlq_size_snapshot",
} as const;

export type MetricName = (typeof METRIC)[keyof typeof METRIC] | string;

export type Tags = Readonly<Record<string, string | number | boolean | null | undefined>>;

// ---------------------------------------------------------------------------
// Safety & sanitization primitives
// ---------------------------------------------------------------------------

/** Max clamp for latency samples (60 seconds). Prevents runaway outliers. */
export const MAX_LATENCY_MS = 60_000;

const warnedOnce = new Set<string>();
const safeWarn = (scope: string, err: unknown): void => {
  try {
    // Rate-limit: each unique scope warns once per process lifetime.
    if (warnedOnce.has(scope)) return;
    warnedOnce.add(scope);
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[telemetry] ${scope} degraded: ${msg}`);
  } catch {
    // Absolute last-resort swallow.
  }
};

// ---------------------------------------------------------------------------
// Private health counter store (module-internal, never exported)
// ---------------------------------------------------------------------------

const HEALTH_STORE_KEY = "__assetly_telemetry_health__";

const getHealthStore = (): Record<string, number> => {
  const g = globalThis as unknown as Record<string, Record<string, number> | undefined>;
  if (!g[HEALTH_STORE_KEY] || typeof g[HEALTH_STORE_KEY] !== "object") {
    g[HEALTH_STORE_KEY] = {};
  }
  return g[HEALTH_STORE_KEY] as Record<string, number>;
};

// ---------------------------------------------------------------------------
// Internal health signals (fail-loud without crashing)
// ---------------------------------------------------------------------------

const DEBUG_TELEMETRY = !Runtime.isBuild();

/** Health counter names — visible in snapshot as regular counters with `_health` tag. */
export const HEALTH_SIGNAL = {
  REGISTRY_INVALID: "_telemetry.registry_invalid_count",
  SNAPSHOT_FALLBACK: "_telemetry.snapshot_fallback_count",
  SILENT_NOOP: "_telemetry.silent_noop_count",
  WRITE_ERROR: "_telemetry.write_error_count",
  REGISTRY_CORRUPTION: "_telemetry.registry_corruption_detected",
} as const;

/**
 * Record a health signal. Completely standalone — zero recursion risk.
 * Production: silent counter increment (visible only via snapshot).
 */
const trackHealthSignal = (name: string): void => {
  try {
    const store = getHealthStore();
    store[name] = (store[name] ?? 0) + 1;
  } catch {
    // Health tracking itself must never crash.
  }
};

// ---------------------------------------------------------------------------
// Mutation version (monotonic counter for snapshot freshness detection)
// ---------------------------------------------------------------------------

const MUTATION_VERSION_KEY = "__assetly_telemetry_version__";
const SNAPSHOT_VERSION_KEY = "__assetly_telemetry_snapshot_version__";

const getMutationVersion = (): number => {
  const g = globalThis as unknown as Record<string, number | undefined>;
  return g[MUTATION_VERSION_KEY] ?? 0;
};

const bumpMutationVersion = (): void => {
  const g = globalThis as unknown as Record<string, number>;
  g[MUTATION_VERSION_KEY] = (g[MUTATION_VERSION_KEY] ?? 0) + 1;
};

const nextMonotonicSnapshotVersion = (minimum: number): number => {
  const g = globalThis as unknown as Record<string, number>;
  const current = g[SNAPSHOT_VERSION_KEY] ?? 0;
  const next = Math.max(current + 1, minimum);
  g[SNAPSHOT_VERSION_KEY] = next;
  return next;
};

/** Sanitize any incoming numeric metric value. Never returns NaN/Infinity/negative. */
export const sanitizeMetric = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return n;
};

/** Clamp latency into [0, MAX_LATENCY_MS]. NaN/Infinity → 0. */
export const clampLatency = (ms: unknown): number => {
  const n = typeof ms === "number" ? ms : Number(ms);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > MAX_LATENCY_MS) return MAX_LATENCY_MS;
  return n;
};

/**
 * Wraps any side-effect writer. Guarantees:
 *   - never throws
 *   - never blocks
 *   - logs once per scope on failure via console.warn
 */
const safeExec = (scope: string, fn: () => void): void => {
  try {
    fn();
  } catch (err) {
    trackHealthSignal(HEALTH_SIGNAL.WRITE_ERROR);
    if (DEBUG_TELEMETRY) console.warn("[telemetry]", `${scope}: write error`, err);
    safeWarn(scope, err);
  }
};

// ---------------------------------------------------------------------------
// Sliding-window aggregation (ring buffer of fixed-size buckets)
// ---------------------------------------------------------------------------
type WindowBucket = {
  startMs: number;
  count: number;
  latencySum: number;
  latencyCount: number;
  samples: number[]; // capped — see BUCKET_SAMPLE_LIMIT
};

const BUCKET_SAMPLE_LIMIT = 16;

type WindowSeries = {
  bucketMs: number;
  numBuckets: number;
  buckets: WindowBucket[];
};

const WINDOW_DEFS = {
  "1m": { bucketMs: 1_000, numBuckets: 60 },
  "5m": { bucketMs: 5_000, numBuckets: 60 },
  "1h": { bucketMs: 60_000, numBuckets: 60 },
} as const;

const createWindowSeries = (bucketMs: number, numBuckets: number): WindowSeries => ({
  bucketMs,
  numBuckets,
  buckets: [],
});

const currentBucketStart = (nowMs: number, bucketMs: number) =>
  Math.floor(nowMs / bucketMs) * bucketMs;

/** Rotates the ring buffer: discards buckets older than windowMs, ensures head bucket exists. */
const advanceSeries = (series: WindowSeries, nowMs: number): WindowBucket => {
  const head = currentBucketStart(nowMs, series.bucketMs);
  const windowMs = series.bucketMs * series.numBuckets;
  const cutoff = head - windowMs + series.bucketMs;

  // Evict expired buckets (O(k) where k = expired count).
  while (series.buckets.length > 0 && series.buckets[0].startMs < cutoff) {
    series.buckets.shift();
  }

  const last = series.buckets[series.buckets.length - 1];
  if (last && last.startMs === head) return last;

  const fresh: WindowBucket = {
    startMs: head,
    count: 0,
    latencySum: 0,
    latencyCount: 0,
    samples: [],
  };
  series.buckets.push(fresh);
  return fresh;
};

const recordCountInSeries = (series: WindowSeries, value: number, nowMs: number): void => {
  const bucket = advanceSeries(series, nowMs);
  bucket.count += value;
};

const recordLatencyInSeries = (series: WindowSeries, ms: number, nowMs: number): void => {
  const bucket = advanceSeries(series, nowMs);
  bucket.latencySum += ms;
  bucket.latencyCount += 1;
  if (bucket.samples.length < BUCKET_SAMPLE_LIMIT) {
    bucket.samples.push(ms);
  } else {
    // Reservoir-style replacement keeps distribution roughly stable without allocation.
    const idx = Math.floor(Math.random() * (bucket.latencyCount));
    if (idx < BUCKET_SAMPLE_LIMIT) bucket.samples[idx] = ms;
  }
};

type WindowAggregate = {
  count: number;
  latencySum: number;
  latencyCount: number;
  samples: number[];
};

const aggregateSeries = (series: WindowSeries, nowMs: number): WindowAggregate => {
  const windowMs = series.bucketMs * series.numBuckets;
  const cutoff = nowMs - windowMs;
  const out: WindowAggregate = { count: 0, latencySum: 0, latencyCount: 0, samples: [] };
  for (const b of series.buckets) {
    if (b.startMs < cutoff) continue;
    out.count += b.count;
    out.latencySum += b.latencySum;
    out.latencyCount += b.latencyCount;
    if (b.samples.length > 0) out.samples.push(...b.samples);
  }
  return out;
};

type MetricWindows = { "1m": WindowSeries; "5m": WindowSeries; "1h": WindowSeries };

const createMetricWindows = (): MetricWindows => ({
  "1m": createWindowSeries(WINDOW_DEFS["1m"].bucketMs, WINDOW_DEFS["1m"].numBuckets),
  "5m": createWindowSeries(WINDOW_DEFS["5m"].bucketMs, WINDOW_DEFS["5m"].numBuckets),
  "1h": createWindowSeries(WINDOW_DEFS["1h"].bucketMs, WINDOW_DEFS["1h"].numBuckets),
});

// ---------------------------------------------------------------------------
// Registry (singleton factory; idempotent, HMR/dup-import safe)
// ---------------------------------------------------------------------------
type CounterEntry = { value: number; tags: Tags | null };
type GaugeEntry = { value: number; tags: Tags | null; updatedAt: number };
type HistogramEntry = {
  count: number;
  sum: number;
  min: number;
  max: number;
  samples: number[];
  tags: Tags | null;
};

type TelemetryRegistry = {
  counters: Map<string, CounterEntry>;
  gauges: Map<string, GaugeEntry>;
  histograms: Map<string, HistogramEntry>;
  startedAt: number;
  gaugeHistory: Map<string, Array<{ value: number; observedAt: number }>>;
  /** Per-metric-name (counter) windowed aggregates. */
  counterWindows: Map<string, MetricWindows>;
  /** Per-metric-name (latency) windowed aggregates. */
  latencyWindows: Map<string, MetricWindows>;
  /** Sealed marker — used to detect duplicate factory invocation. */
  readonly __sealed: true;
  readonly __version: number;
};

const HISTOGRAM_SAMPLE_LIMIT = 200;
const GAUGE_HISTORY_LIMIT = 20;
const REGISTRY_VERSION = 2;
const GLOBAL_KEY = "__assetly_event_telemetry_v2__";

const buildRegistry = (): TelemetryRegistry =>
  Object.freeze({
    counters: new Map(),
    gauges: new Map(),
    histograms: new Map(),
    startedAt: Date.now(),
    gaugeHistory: new Map(),
    counterWindows: new Map(),
    latencyWindows: new Map(),
    __sealed: true as const,
    __version: REGISTRY_VERSION,
  }) as TelemetryRegistry;

/**
 * Idempotent singleton factory.
 *
 * Safe against:
 *   - duplicate imports (bundler dedupe edge cases, HMR reloads)
 *   - multiple init attempts (subsequent calls are no-ops)
 *   - stale version objects from older deploys sharing the same runtime
 */
export const createTelemetryRegistry = (): TelemetryRegistry => {
  const g = globalThis as unknown as Record<string, TelemetryRegistry | undefined>;
  const existing = g[GLOBAL_KEY];
  if (existing && existing.__sealed && existing.__version === REGISTRY_VERSION) {
    return existing;
  }
  const created = buildRegistry();
  g[GLOBAL_KEY] = created;
  return created;
};

/** Lazy accessor — never throws, always returns a usable registry. */
const getRegistry = (): TelemetryRegistry => {
  try {
    return createTelemetryRegistry();
  } catch (err) {
    trackHealthSignal(HEALTH_SIGNAL.REGISTRY_CORRUPTION);
    if (DEBUG_TELEMETRY) console.warn("[telemetry]", "registry corrupted, using ephemeral", err);
    safeWarn("registry_init", err);
    // Last-resort ephemeral registry — loses state but keeps API contract.
    return buildRegistry();
  }
};

const getOrCreateCounterWindows = (reg: TelemetryRegistry, name: string): MetricWindows => {
  let w = reg.counterWindows.get(name);
  if (!w) {
    w = createMetricWindows();
    reg.counterWindows.set(name, w);
  }
  return w;
};

const getOrCreateLatencyWindows = (reg: TelemetryRegistry, name: string): MetricWindows => {
  let w = reg.latencyWindows.get(name);
  if (!w) {
    w = createMetricWindows();
    reg.latencyWindows.set(name, w);
  }
  return w;
};

/** Fast validity check — prevents writes against a corrupted/foreign registry. */
const isRegistryUsable = (
  reg: TelemetryRegistry | null | undefined,
): reg is TelemetryRegistry =>
  Boolean(
    reg &&
    reg.__sealed === true &&
    reg.__version === REGISTRY_VERSION &&
    reg.counters instanceof Map &&
    reg.gauges instanceof Map &&
    reg.histograms instanceof Map,
  );

const serializeTags = (tags: Tags | null | undefined): string => {
  if (!tags) return "";
  const entries = Object.entries(tags)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  return entries.join(",");
};

const keyOf = (name: string, tags: Tags | null | undefined): string =>
  tags && Object.keys(tags).length > 0 ? `${name}|${serializeTags(tags)}` : name;

// ---------------------------------------------------------------------------
// incrementCounter  (sanitized, windowed, never throws)
// ---------------------------------------------------------------------------
export const incrementCounter = (
  name: MetricName,
  tags?: Tags,
  value = 1,
): void => {
  safeExec("incrementCounter", () => {
    const sanitized = sanitizeMetric(value);
    if (sanitized === 0) return;
    const reg = getRegistry();
    if (!isRegistryUsable(reg)) {
      trackHealthSignal(HEALTH_SIGNAL.REGISTRY_INVALID);
      if (DEBUG_TELEMETRY) console.warn("[telemetry]", "incrementCounter: registry unusable");
      return;
    }
    const k = keyOf(name, tags ?? null);
    const existing = reg.counters.get(k);
    if (existing) {
      const next = existing.value + sanitized;
      existing.value = next < 0 ? 0 : next;
    } else {
      reg.counters.set(k, { value: sanitized, tags: tags ?? null });
    }
    // Windowed signal — skipped on edge runtime (lightweight mode).
    if (!Runtime.isEdge()) {
      const now = Date.now();
      const mw = getOrCreateCounterWindows(reg, String(name));
      recordCountInSeries(mw["1m"], sanitized, now);
      recordCountInSeries(mw["5m"], sanitized, now);
      recordCountInSeries(mw["1h"], sanitized, now);
    }
    bumpMutationVersion();
  });
};

// ---------------------------------------------------------------------------
// recordLatency  (clamped 0–60s, windowed, never throws)
// ---------------------------------------------------------------------------
export const recordLatency = (
  name: MetricName,
  ms: number,
  tags?: Tags,
): void => {
  safeExec("recordLatency", () => {
    const clamped = clampLatency(ms);
    const reg = getRegistry();
    if (!isRegistryUsable(reg)) {
      trackHealthSignal(HEALTH_SIGNAL.REGISTRY_INVALID);
      if (DEBUG_TELEMETRY) console.warn("[telemetry]", "recordLatency: registry unusable");
      return;
    }
    const k = keyOf(name, tags ?? null);
    const existing = reg.histograms.get(k);
    if (existing) {
      existing.count += 1;
      existing.sum += clamped;
      existing.min = Math.min(existing.min, clamped);
      existing.max = Math.max(existing.max, clamped);
      existing.samples.push(clamped);
      if (existing.samples.length > HISTOGRAM_SAMPLE_LIMIT) {
        existing.samples.splice(0, existing.samples.length - HISTOGRAM_SAMPLE_LIMIT);
      }
    } else {
      reg.histograms.set(k, {
        count: 1,
        sum: clamped,
        min: clamped,
        max: clamped,
        samples: [clamped],
        tags: tags ?? null,
      });
    }
    if (!Runtime.isEdge()) {
      const now = Date.now();
      const mw = getOrCreateLatencyWindows(reg, String(name));
      recordLatencyInSeries(mw["1m"], clamped, now);
      recordLatencyInSeries(mw["5m"], clamped, now);
      recordLatencyInSeries(mw["1h"], clamped, now);
    }
    bumpMutationVersion();
  });
};

// ---------------------------------------------------------------------------
// setGauge (sanitized, never throws)
// ---------------------------------------------------------------------------
export const setGauge = (name: MetricName, value: number, tags?: Tags): void => {
  safeExec("setGauge", () => {
    const sanitized = sanitizeMetric(value);
    const reg = getRegistry();
    if (!isRegistryUsable(reg)) {
      trackHealthSignal(HEALTH_SIGNAL.REGISTRY_INVALID);
      if (DEBUG_TELEMETRY) console.warn("[telemetry]", "setGauge: registry unusable");
      return;
    }
    const k = keyOf(name, tags ?? null);
    reg.gauges.set(k, { value: sanitized, tags: tags ?? null, updatedAt: Date.now() });
    const history = reg.gaugeHistory.get(k) ?? [];
    history.push({ value: sanitized, observedAt: Date.now() });
    if (history.length > GAUGE_HISTORY_LIMIT) {
      history.splice(0, history.length - GAUGE_HISTORY_LIMIT);
    }
    reg.gaugeHistory.set(k, history);
    bumpMutationVersion();
  });
};

// ---------------------------------------------------------------------------
// emitStructuredLog
// ---------------------------------------------------------------------------
export type StructuredLogEvent = {
  event: string;
  status: string;
  latency_ms?: number | null;
  entity_id?: string | null;
  meta?: Record<string, unknown>;
  level?: "debug" | "info" | "warn" | "error";
};

const safeWriteLine = (line: string): void => {
  try {
    if (typeof process !== "undefined" && process.stdout?.write) {
      process.stdout.write(`${line}\n`);
      return;
    }
  } catch {
    // fall through
  }
  try {
    console.log(line);
  } catch {
    // swallow
  }
};

/**
 * Fire-and-forget structured log. Shape (per spec):
 *   { timestamp, event, status, latency_ms, entity_id, meta }
 */
export const emitStructuredLog = (event: StructuredLogEvent): void => {
  // Build phase: accept calls but suppress stdout to avoid polluting build logs.
  if (isBuildPhase()) {
    trackHealthSignal(HEALTH_SIGNAL.SILENT_NOOP);
    if (DEBUG_TELEMETRY) console.warn("[telemetry]", "emitStructuredLog: suppressed during build phase");
    return;
  }
  const payload = {
    timestamp: new Date().toISOString(),
    level: event.level ?? "info",
    event: event.event,
    status: event.status,
    latency_ms: event.latency_ms ?? null,
    entity_id: event.entity_id ?? null,
    meta: event.meta ?? {},
  };
  const flush = () => {
    try {
      safeWriteLine(JSON.stringify(payload));
    } catch {
      // swallow
    }
  };
  if (typeof queueMicrotask === "function") {
    queueMicrotask(flush);
  } else {
    setTimeout(flush, 0);
  }
};

// ---------------------------------------------------------------------------
// Snapshot API (admin-facing)
// ---------------------------------------------------------------------------
export type CounterSnapshot = { name: string; tags: Tags | null; value: number };
export type GaugeSnapshot = {
  name: string;
  tags: Tags | null;
  value: number;
  updatedAt: string;
  history: Array<{ value: number; observedAt: string }>;
};
export type HistogramSnapshot = {
  name: string;
  tags: Tags | null;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
};

export type TelemetrySnapshot = {
  counters: CounterSnapshot[];
  gauges: GaugeSnapshot[];
  histograms: HistogramSnapshot[];
  uptimeMs: number;
  generatedAt: string;
  /** Monotonic counter — incremented on every metric mutation. */
  snapshotVersion: number;
  /** Epoch ms when this snapshot was generated. */
  snapshotTimestamp: number;
};

export const getAdaptiveStalenessWindowMs = (snapshot?: TelemetrySnapshot): number => {
  const source = snapshot ?? getTelemetrySnapshot();
  const success = source.counters
    .filter((counter) => counter.name === METRIC.EVENT_DISPATCH_SUCCESS_TOTAL)
    .reduce((sum, counter) => sum + counter.value, 0);
  const failure = source.counters
    .filter((counter) => counter.name === METRIC.EVENT_DISPATCH_FAILURE_TOTAL)
    .reduce((sum, counter) => sum + counter.value, 0);

  const totalDispatch = success + failure;
  if (totalDispatch < 100) return 1_500;
  if (totalDispatch < 5_000) return 5_000;
  return 10_000;
};

const splitKey = (key: string): { name: string; tagsPart: string } => {
  const idx = key.indexOf("|");
  if (idx === -1) return { name: key, tagsPart: "" };
  return { name: key.slice(0, idx), tagsPart: key.slice(idx + 1) };
};

const percentile = (sortedAsc: number[], p: number): number => {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
};

/** Deep-clone tags to prevent external mutation of internal state. */
const cloneTags = (tags: Tags | null): Tags | null =>
  tags ? { ...tags } : null;

const EMPTY_SNAPSHOT: Readonly<TelemetrySnapshot> = Object.freeze({
  counters: [],
  gauges: [],
  histograms: [],
  uptimeMs: 0,
  generatedAt: "",
  snapshotVersion: 0,
  snapshotTimestamp: 0,
});

/**
 * Returns a deep-cloned, immutable snapshot. Never mutates internal state.
 * Wrapped in try/catch — returns empty snapshot on any failure.
 */
export const getTelemetrySnapshot = (): TelemetrySnapshot => {
  try {
    const reg = getRegistry();
    if (!isRegistryUsable(reg)) {
      trackHealthSignal(HEALTH_SIGNAL.REGISTRY_INVALID);
      trackHealthSignal(HEALTH_SIGNAL.SNAPSHOT_FALLBACK);
      if (DEBUG_TELEMETRY) console.warn("[telemetry]", "snapshot: registry unusable, returning empty");
      return {
        ...EMPTY_SNAPSHOT,
        generatedAt: new Date().toISOString(),
        snapshotVersion: nextMonotonicSnapshotVersion(getMutationVersion()),
        snapshotTimestamp: Date.now(),
      };
    }

    const counters: CounterSnapshot[] = [];
    for (const [key, entry] of reg.counters) {
      counters.push({ name: splitKey(key).name, tags: cloneTags(entry.tags), value: entry.value });
    }

    // Merge health signals into counters — makes them visible in the admin
    // dashboard without requiring a separate endpoint or data model.
    try {
      const healthStore = getHealthStore();
      for (const hName of Object.keys(healthStore)) {
        const hValue = healthStore[hName];
        if (hValue > 0) {
          counters.push({ name: hName, tags: { _health: "true" }, value: hValue });
        }
      }
    } catch {
      // Health map read failure must not break the snapshot.
    }

    const gauges: GaugeSnapshot[] = [];
    for (const [key, entry] of reg.gauges) {
      const hist = reg.gaugeHistory.get(key) ?? [];
      gauges.push({
        name: splitKey(key).name,
        tags: cloneTags(entry.tags),
        value: entry.value,
        updatedAt: new Date(entry.updatedAt).toISOString(),
        history: hist.map((h) => ({ value: h.value, observedAt: new Date(h.observedAt).toISOString() })),
      });
    }

    const histograms: HistogramSnapshot[] = [];
    for (const [key, entry] of reg.histograms) {
      const sorted = [...entry.samples].sort((a, b) => a - b);
      histograms.push({
        name: splitKey(key).name,
        tags: cloneTags(entry.tags),
        count: entry.count,
        sum: entry.sum,
        avg: entry.count === 0 ? 0 : Math.round(entry.sum / entry.count),
        min: entry.min,
        max: entry.max,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
      });
    }

    return Object.freeze({
      counters,
      gauges,
      histograms,
      uptimeMs: Date.now() - reg.startedAt,
      generatedAt: new Date().toISOString(),
      snapshotVersion: nextMonotonicSnapshotVersion(getMutationVersion()),
      snapshotTimestamp: Date.now(),
    });
  } catch (err) {
    trackHealthSignal(HEALTH_SIGNAL.SNAPSHOT_FALLBACK);
    if (DEBUG_TELEMETRY) console.error("[telemetry:snapshot]", err);
    safeWarn("getTelemetrySnapshot", err);
    return {
      ...EMPTY_SNAPSHOT,
      generatedAt: new Date().toISOString(),
      snapshotVersion: nextMonotonicSnapshotVersion(getMutationVersion()),
      snapshotTimestamp: Date.now(),
    };
  }
};

// ---------------------------------------------------------------------------
// Coalesced refresh gate (module-private, reduces redundant recomputation)
// ---------------------------------------------------------------------------

let _cachedFreshSnapshot: TelemetrySnapshot | null = null;
let _lastFreshSnapshotAt = 0;
let _isFreshSnapshotComputing = false;

/**
 * Returns a fresh snapshot with bounded-staleness coalescing.
 *
 * - If a cached snapshot exists AND (within 2 s reuse window OR no mutations
 *   since last snapshot) → returns cached snapshot without recomputation.
 * - Otherwise generates a new snapshot, caches it, and returns it.
 *
 * Safe for synchronous calls. Does not mutate external state.
 * Module-private cache — never accessible from alerts/dlq.
 */
export const requestFreshSnapshot = (): TelemetrySnapshot => {
  const now = Date.now();
  const currentMutationVersion = getMutationVersion();

  if (_cachedFreshSnapshot) {
    const adaptiveReuseWindowMs = getAdaptiveStalenessWindowMs(_cachedFreshSnapshot);
    const withinReuseWindow = now - _lastFreshSnapshotAt < adaptiveReuseWindowMs;
    const noNewMutations = _cachedFreshSnapshot.snapshotVersion >= currentMutationVersion;
    if (withinReuseWindow || noNewMutations) {
      return _cachedFreshSnapshot;
    }
  }

  if (_isFreshSnapshotComputing && _cachedFreshSnapshot) {
    return _cachedFreshSnapshot;
  }

  _isFreshSnapshotComputing = true;

  try {
    const snap = getTelemetrySnapshot();
    const shouldReplaceCache =
      !_cachedFreshSnapshot ||
      snap.snapshotVersion >= _cachedFreshSnapshot.snapshotVersion ||
      snap.snapshotTimestamp >= _cachedFreshSnapshot.snapshotTimestamp;

    if (shouldReplaceCache) {
      _cachedFreshSnapshot = snap;
      _lastFreshSnapshotAt = now;
    }

    return _cachedFreshSnapshot ?? snap;
  } finally {
    _isFreshSnapshotComputing = false;
  }
};

/**
 * Test-only. Resets the process-global registry.
 *
 * Atomic: swaps the globalThis pointer to a fresh registry. In-flight writes
 * that already captured the old reference via getRegistry() at the top of
 * their safeExec callback will complete harmlessly against the orphaned
 * instance. New writes pick up the fresh registry on next getRegistry() call.
 */
export const __resetTelemetryForTests = (): void => {
  safeExec("__resetTelemetryForTests", () => {
    const g = globalThis as unknown as Record<string, TelemetryRegistry | undefined>;
    g[GLOBAL_KEY] = buildRegistry();
    (globalThis as unknown as Record<string, number>)[MUTATION_VERSION_KEY] = 0;
    (globalThis as unknown as Record<string, number>)[SNAPSHOT_VERSION_KEY] = 0;
    _cachedFreshSnapshot = null;
    _lastFreshSnapshotAt = 0;
    _isFreshSnapshotComputing = false;
  });
};

/**
 * Internal accessor for alert-hooks (gauge history read).
 * Returns a shallow copy to prevent external mutation of internal arrays.
 */
export const __getGaugeHistory = (
  name: MetricName,
  tags?: Tags,
): Array<{ value: number; observedAt: number }> => {
  try {
    const reg = getRegistry();
    if (!isRegistryUsable(reg)) {
      trackHealthSignal(HEALTH_SIGNAL.REGISTRY_INVALID);
      if (DEBUG_TELEMETRY) console.warn("[telemetry]", "__getGaugeHistory: registry unusable");
      return [];
    }
    const history = reg.gaugeHistory.get(keyOf(name, tags ?? null));
    return history ? history.map((h) => ({ ...h })) : [];
  } catch (err) {
    safeWarn("__getGaugeHistory", err);
    return [];
  }
};

/**
 * Internal accessor — returns counter totals by name (sum across tag variants).
 */
export const __getCounterTotal = (name: MetricName): number => {
  try {
    const reg = getRegistry();
    if (!isRegistryUsable(reg)) {
      trackHealthSignal(HEALTH_SIGNAL.REGISTRY_INVALID);
      if (DEBUG_TELEMETRY) console.warn("[telemetry]", "__getCounterTotal: registry unusable");
      return 0;
    }
    let total = 0;
    for (const [key, entry] of reg.counters) {
      if (splitKey(key).name === name) total += entry.value;
    }
    return total;
  } catch (err) {
    safeWarn("__getCounterTotal", err);
    return 0;
  }
};
