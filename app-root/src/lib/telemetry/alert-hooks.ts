import "server-only";

import {
  getAdaptiveStalenessWindowMs,
  METRIC,
  emitStructuredLog,
  getTelemetrySnapshot,
  requestFreshSnapshot,
  type TelemetrySnapshot,
} from "@/lib/telemetry/event-telemetry";
import { ServerEnv } from "@/lib/env/server-env";

/**
 * ALERT HOOKS (Fire-and-Forget)
 * ============================================================================
 * Non-blocking alert evaluator. Triggered by:
 *   - failure rate > 5% (over lifetime of the process)
 *   - retry count spikes (delta vs. previous evaluation > threshold)
 *   - DLQ growing continuously (last N gauge samples strictly non-decreasing)
 *
 * Delivery: optional webhook via ALERT_WEBHOOK_URL (JSON POST). If unset,
 * alerts are only logged as structured events — the admin dashboard picks
 * them up via getActiveAlerts().
 *
 * All network calls run inside a detached promise; callers never await them.
 * ============================================================================
 */

export type AlertKind = "FAILURE_RATE_HIGH" | "RETRY_SPIKE" | "DLQ_GROWING";
export type AlertSeverity = "warning" | "critical";

export type Alert = {
  kind: AlertKind;
  severity: AlertSeverity;
  message: string;
  firedAt: string;
  meta: Record<string, unknown>;
};

export type EvaluateAlertsInput = {
  /** Failure-rate trigger threshold (0..1). Default 0.05 (5%). */
  failureRateThreshold?: number;
  /** Retry spike trigger delta. Default 25 (since previous eval). */
  retrySpikeThreshold?: number;
  /** DLQ growth trigger: N non-decreasing samples. Default 3. */
  dlqGrowingSamples?: number;
  /** Minimum total dispatch count before failure-rate alert fires. Default 20. */
  minDispatchVolume?: number;
  /** Per-kind cooldown in ms. Default 600 000 (10 min). */
  cooldownMs?: number;
};

type EvaluatorState = {
  lastRetryCount: number;
  lastEvaluationAt: number;
  lastAlerts: Alert[];
};

/** Default cooldown: 10 minutes. Same alert kind won't re-fire within this window. */
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1_000;

const GLOBAL_KEY = "__assetly_alert_evaluator__";

const getState = (): EvaluatorState => {
  const g = globalThis as unknown as Record<string, EvaluatorState | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      lastRetryCount: 0,
      lastEvaluationAt: 0,
      lastAlerts: [],
    };
  }
  return g[GLOBAL_KEY] as EvaluatorState;
};

// ---------------------------------------------------------------------------
// Module-private cooldown store (isolated from other modules)
// ---------------------------------------------------------------------------

const COOLDOWN_KEY = "__assetly_alert_cooldowns__";

const getCooldowns = (): Record<string, number> => {
  const g = globalThis as unknown as Record<string, Record<string, number> | undefined>;
  if (!g[COOLDOWN_KEY] || typeof g[COOLDOWN_KEY] !== "object") {
    g[COOLDOWN_KEY] = {};
  }
  return g[COOLDOWN_KEY] as Record<string, number>;
};

/** Returns true if the given alert kind is still within its cooldown window. */
const isOnCooldown = (kind: AlertKind, cooldownMs: number): boolean => {
  try {
    const lastFired = getCooldowns()[kind];
    if (!lastFired) return false;
    return Date.now() - lastFired < cooldownMs;
  } catch {
    return false;
  }
};

/** Record that an alert kind just fired (module-private cooldown timestamp). */
const markFired = (kind: AlertKind): void => {
  try {
    getCooldowns()[kind] = Date.now();
  } catch {
    // never crash
  }
};

// ---------------------------------------------------------------------------
// Pure snapshot-based helpers (no direct telemetry registry access)
// ---------------------------------------------------------------------------

/** Sum counter values for a given metric name across all tag variants. */
const counterTotal = (snapshot: TelemetrySnapshot, name: string): number => {
  let total = 0;
  for (const c of snapshot.counters) {
    if (c.name === name) total += c.value;
  }
  return total;
};

/** Extract gauge history values for a given metric name from snapshot. */
const gaugeHistoryValues = (snapshot: TelemetrySnapshot, name: string): number[] => {
  for (const g of snapshot.gauges) {
    if (g.name === name) return g.history.map((h) => h.value);
  }
  return [];
};

const isDlqGrowing = (samples: number[], minSamples: number): boolean => {
  if (samples.length < minSamples) return false;
  const tail = samples.slice(-minSamples);
  for (let i = 1; i < tail.length; i += 1) {
    if (tail[i] <= tail[i - 1]) return false;
  }
  return true;
};

export const evaluateAlerts = (
  input: EvaluateAlertsInput = {},
  snapshot: TelemetrySnapshot = getTelemetrySnapshot(),
): Alert[] => {
  // Freshness check: if snapshot is stale, request a fresh one from telemetry.
  if (Date.now() - snapshot.snapshotTimestamp > getAdaptiveStalenessWindowMs(snapshot)) {
    snapshot = requestFreshSnapshot();
  }

  const failureRateThreshold = input.failureRateThreshold ?? 0.05;
  const retrySpikeThreshold = input.retrySpikeThreshold ?? 25;
  const dlqGrowingSamples = input.dlqGrowingSamples ?? 3;
  const minDispatchVolume = input.minDispatchVolume ?? 20;
  const cooldownMs = input.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  const state = getState();
  const alerts: Alert[] = [];
  const now = new Date().toISOString();

  // --- Failure rate (derived from snapshot counters) ---
  if (!isOnCooldown("FAILURE_RATE_HIGH", cooldownMs)) {
    const success = counterTotal(snapshot, METRIC.EVENT_DISPATCH_SUCCESS_TOTAL);
    const failure = counterTotal(snapshot, METRIC.EVENT_DISPATCH_FAILURE_TOTAL);
    const total = success + failure;
    const failureRate = total === 0 ? 0 : failure / total;

    if (total >= minDispatchVolume && failureRate > failureRateThreshold) {
      alerts.push({
        kind: "FAILURE_RATE_HIGH",
        severity: failureRate > failureRateThreshold * 2 ? "critical" : "warning",
        message: `Failure rate ${(failureRate * 100).toFixed(2)}% exceeds threshold ${(failureRateThreshold * 100).toFixed(2)}%`,
        firedAt: now,
        meta: { success, failure, total, failureRate },
      });
    }
  }

  // --- Retry spike (derived from snapshot counters) ---
  if (!isOnCooldown("RETRY_SPIKE", cooldownMs)) {
    const retryTotal = counterTotal(snapshot, METRIC.NOTIFICATION_RETRY_COUNT);
    const retryDelta = retryTotal - state.lastRetryCount;
    if (retryDelta >= retrySpikeThreshold) {
      alerts.push({
        kind: "RETRY_SPIKE",
        severity: retryDelta >= retrySpikeThreshold * 2 ? "critical" : "warning",
        message: `Retry count increased by ${retryDelta} since last evaluation (threshold ${retrySpikeThreshold})`,
        firedAt: now,
        meta: { retryTotal, retryDelta, since: state.lastEvaluationAt },
      });
    }
    // Always update baseline regardless of cooldown.
    state.lastRetryCount = retryTotal;
  }
  state.lastEvaluationAt = Date.now();

  // --- DLQ growing (derived from snapshot gauge history) ---
  if (!isOnCooldown("DLQ_GROWING", cooldownMs)) {
    const dlqHistory = gaugeHistoryValues(snapshot, METRIC.DLQ_SIZE_SNAPSHOT);
    if (isDlqGrowing(dlqHistory, dlqGrowingSamples)) {
      const tail = dlqHistory.slice(-dlqGrowingSamples);
      alerts.push({
        kind: "DLQ_GROWING",
        severity: "warning",
        message: `DLQ has grown for ${dlqGrowingSamples} consecutive snapshots (${tail.join(" → ")})`,
        firedAt: now,
        meta: { samples: tail },
      });
    }
  }

  state.lastAlerts = alerts;
  return alerts;
};

/**
 * Fire-and-forget dispatcher. Returns immediately; webhook POST runs in
 * background. Failures are logged but never re-thrown.
 */
export const dispatchAlerts = (alerts: Alert[]): void => {
  if (alerts.length === 0) return;

  for (const alert of alerts) {
    // Record cooldown timestamp so the same kind doesn't re-fire within window.
    markFired(alert.kind);

    emitStructuredLog({
      event: "alert.fired",
      status: "alert_triggered",
      level: alert.severity === "critical" ? "error" : "warn",
      entity_id: null,
      meta: { kind: alert.kind, severity: alert.severity, message: alert.message, ...alert.meta },
    });
  }

  const webhook = ServerEnv.ALERT_WEBHOOK_URL;
  if (!webhook) return;

  // Detached promise — caller is never blocked.
  void (async () => {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "assetly.notifications",
          firedAt: new Date().toISOString(),
          alerts,
        }),
      });
    } catch (err) {
      emitStructuredLog({
        event: "alert.webhook_failed",
        status: "failure",
        level: "error",
        meta: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  })();
};

/**
 * Combined evaluate + dispatch. Returns the alerts list so callers (e.g. the
 * admin API route) can surface them in the response without a second pass.
 */
export const evaluateAndDispatchAlerts = (input?: EvaluateAlertsInput): Alert[] => {
  const alerts = evaluateAlerts(input);
  dispatchAlerts(alerts);
  return alerts;
};

/** Last computed alerts (for admin dashboard, no recomputation). */
export const getActiveAlerts = (): Alert[] => getState().lastAlerts;
