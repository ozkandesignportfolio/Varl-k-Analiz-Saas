import "server-only";

import {
  AppEventType,
  DispatchStage,
  DispatchErrorCode,
} from "@/lib/events/app-event";

/**
 * DISPATCH OBSERVABILITY
 * ============================================================================
 * Structured logging for notification dispatch system.
 * - dispatch:outcome log schema
 * - Metrics emission for log aggregators
 * ============================================================================
 */

const SERVICE_TAG = "[observability]";

const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(`${SERVICE_TAG} ${event}`, payload);
};

type DispatchMetricOutcome = "created" | "deduped" | "failed";

export type DispatchMetricPayload = {
  outcome: DispatchMetricOutcome;
  eventType: AppEventType | null;
  userId: string | null;
  eventId: string | null;
  dedupeKey: string | null;
  latencyMs: number;
  stage: DispatchStage | null;
  code: DispatchErrorCode | null;
  notificationId?: string | null;
  error?: string | null;
  route?: string;
  method?: string;
};

/**
 * Her dispatch çağrısı için stdout'a yapılandırılmış JSON log yazar.
 * Log aggregator (Vercel / Supabase logs / Datadog) bu satırları:
 *   - outcome="created"  → event_created_count, notification_created_count
 *   - outcome="deduped"  → dedupe_suppressed_count
 *   - outcome="failed"   → event_failed_count, notification_failed_count
 *   - latency_ms         → dispatch_latency_ms histogram
 */
export const emitDispatchMetric = (payload: DispatchMetricPayload): void => {
  try {
    process.stdout.write(
      `${JSON.stringify({
        event: "dispatch:outcome",
        eventId: payload.eventId,
        userId: payload.userId,
        eventType: payload.eventType,
        dedupeKey: payload.dedupeKey,
        stage: payload.stage,
        code: payload.code,
        latencyMs: Math.max(0, Math.round(payload.latencyMs)),
        outcome: payload.outcome,
      })}\n`,
    );
  } catch {
    // Serialization hatası durumunda bile dispatch akışını bozmayız.
  }
};

/**
 * Retry worker observability.
 */
export const emitRetryMetric = (payload: {
  processed: number;
  repaired: number;
  failed: number;
  deadLetterRetried: number;
  latencyMs: number;
}): void => {
  const outcome =
    payload.failed === 0 && payload.repaired > 0
      ? "success"
      : payload.failed > 0
      ? "partial"
      : "noop";

  console.log(
    JSON.stringify({
      event: "retry:outcome",
      processed: payload.processed,
      repaired: payload.repaired,
      failed: payload.failed,
      deadLetterRetried: payload.deadLetterRetried,
      latencyMs: payload.latencyMs,
      outcome,
    }),
  );
};

/**
 * Debug-level service event logging.
 */
export const logServiceEvent = (
  service: string,
  event: string,
  payload: Record<string, unknown>,
): void => {
  logEvent(`${service}:${event}`, payload);
};
