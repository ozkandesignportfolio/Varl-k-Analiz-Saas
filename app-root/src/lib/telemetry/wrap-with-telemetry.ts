import "server-only";

import {
  METRIC,
  emitStructuredLog,
  incrementCounter,
  recordLatency,
  type Tags,
} from "@/lib/telemetry/event-telemetry";

/**
 * WRAP WITH TELEMETRY
 * ============================================================================
 * Generic, non-intrusive wrapper that augments any async function with:
 *   - success / failure counters
 *   - latency histogram
 *   - structured log (fire-and-forget)
 *
 * The wrapped function's signature is preserved exactly. Wrapping is a pure
 * decorator: no args are modified, no exceptions are swallowed. If the inner
 * function throws, the wrapper re-throws after recording the failure.
 *
 * Usage (opt-in, next to call sites — existing emitters remain untouched):
 *
 *   const dispatchWithTelemetry = wrapWithTelemetry(dispatchWithMetrics, {
 *     eventName: "notification.dispatch",
 *     successCounter: METRIC.EVENT_DISPATCH_SUCCESS_TOTAL,
 *     failureCounter: METRIC.EVENT_DISPATCH_FAILURE_TOTAL,
 *     latencyMetric:  METRIC.NOTIFICATION_LATENCY_MS,
 *     extractEntityId: (args, result) =>
 *       (result && typeof result === "object" && "eventId" in result)
 *         ? (result as { eventId?: string }).eventId ?? null
 *         : null,
 *   });
 * ============================================================================
 */

export type WrapOptions<TArgs extends unknown[], TResult> = {
  /** Human-readable event label used in structured logs (e.g. "notification.dispatch"). */
  eventName: string;
  /** Counter name incremented on success. Defaults to event_dispatch_success_total. */
  successCounter?: string;
  /** Counter name incremented on failure. Defaults to event_dispatch_failure_total. */
  failureCounter?: string;
  /** Latency histogram metric name. Defaults to notification_latency_ms. */
  latencyMetric?: string;
  /** Static tags merged into every emission. */
  tags?: Tags;
  /**
   * Optional: extract entity_id (event_id / notification_id) from args or
   * return value. Runs inside try/catch so it never breaks the wrapper.
   */
  extractEntityId?: (args: TArgs, result: TResult | undefined) => string | null | undefined;
  /**
   * Optional: classify a successful return as a failure (e.g. the callee
   * returns a `{ ok: false }` union instead of throwing). Defaults to
   * treating any non-throwing return as success.
   */
  isFailureResult?: (result: TResult) => boolean;
  /**
   * Optional: derive extra meta fields for the structured log.
   */
  extractMeta?: (args: TArgs, result: TResult | undefined, error: unknown) => Record<string, unknown> | undefined;
};

const defaultSuccessCounter = METRIC.EVENT_DISPATCH_SUCCESS_TOTAL;
const defaultFailureCounter = METRIC.EVENT_DISPATCH_FAILURE_TOTAL;
const defaultLatencyMetric = METRIC.NOTIFICATION_LATENCY_MS;

const safeExtract = <T>(fn: (() => T) | undefined, fallback: T): T => {
  if (!fn) return fallback;
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/**
 * Wraps an async function with telemetry. Signature is preserved:
 *
 *   wrapWithTelemetry<typeof fn>(fn, options) → same (…args) => Promise<Result>
 */
export const wrapWithTelemetry = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: WrapOptions<TArgs, TResult>,
): ((...args: TArgs) => Promise<TResult>) => {
  const successCounter = options.successCounter ?? defaultSuccessCounter;
  const failureCounter = options.failureCounter ?? defaultFailureCounter;
  const latencyMetric = options.latencyMetric ?? defaultLatencyMetric;

  return async (...args: TArgs): Promise<TResult> => {
    const startedAt = Date.now();
    let result: TResult | undefined;
    let error: unknown = null;

    try {
      result = await fn(...args);
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const latency = Date.now() - startedAt;
      const failed =
        error !== null ||
        (result !== undefined && options.isFailureResult
          ? safeExtract(() => options.isFailureResult!(result as TResult), false)
          : false);

      const entityId = safeExtract(
        () => (options.extractEntityId ? options.extractEntityId(args, result) ?? null : null),
        null,
      );

      const meta =
        safeExtract(
          () =>
            options.extractMeta
              ? options.extractMeta(args, result, error)
              : undefined,
          undefined,
        ) ?? {};

      // Counters + histogram (in-process, non-blocking).
      incrementCounter(failed ? failureCounter : successCounter, options.tags);
      recordLatency(latencyMetric, latency, options.tags);

      // Structured log (fire-and-forget via queueMicrotask).
      emitStructuredLog({
        event: options.eventName,
        status: failed ? "failure" : "success",
        latency_ms: latency,
        entity_id: entityId,
        level: failed ? "error" : "info",
        meta: {
          ...meta,
          ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
        },
      });
    }
  };
};

/**
 * Convenience factory for the notification dispatcher.
 */
export const wrapDispatcher = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  extractEntityId?: WrapOptions<TArgs, TResult>["extractEntityId"],
  isFailureResult?: WrapOptions<TArgs, TResult>["isFailureResult"],
) =>
  wrapWithTelemetry(fn, {
    eventName: "notification.dispatch",
    successCounter: METRIC.EVENT_DISPATCH_SUCCESS_TOTAL,
    failureCounter: METRIC.EVENT_DISPATCH_FAILURE_TOTAL,
    latencyMetric: METRIC.NOTIFICATION_LATENCY_MS,
    extractEntityId,
    isFailureResult,
  });

/**
 * Convenience factory for the retry handler. Also increments
 * notification_retry_count on every invocation (regardless of outcome).
 */
export const wrapRetryHandler = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  extractEntityId?: WrapOptions<TArgs, TResult>["extractEntityId"],
) =>
  wrapWithTelemetry(fn, {
    eventName: "notification.retry",
    successCounter: METRIC.EVENT_DISPATCH_SUCCESS_TOTAL,
    failureCounter: METRIC.EVENT_DISPATCH_FAILURE_TOTAL,
    latencyMetric: METRIC.NOTIFICATION_LATENCY_MS,
    extractEntityId,
    extractMeta: () => {
      incrementCounter(METRIC.NOTIFICATION_RETRY_COUNT);
      return { retry: true };
    },
  });
