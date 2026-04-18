import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppEventType,
  DispatchStage,
  DispatchErrorCode,
  type AppEvent,
  type DispatchResult,
} from "@/lib/events/app-event";
import { emitDispatchMetric } from "@/lib/observability/dispatch-metrics";
import { normalizeContext } from "@/lib/mappers/notification-mappers";
import { dispatchRouter } from "./dispatch-router";

/**
 * DISPATCH EXECUTOR
 * ============================================================================
 * Coordinates dispatch flow:
 * 1. Routes to correct handler
 * 2. Measures latency
 * 3. Emits metrics
 * ============================================================================
 */

export const dispatchWithMetrics = async (
  adminClient: SupabaseClient,
  event: AppEvent,
  context?: { route?: string; method?: string },
): Promise<DispatchResult> => {
  const startedAt = Date.now();
  const { route, method } = normalizeContext(context);
  const result = await dispatchRouter(adminClient, event, context);
  const latencyMs = Date.now() - startedAt;

  type DispatchMetricOutcome = "created" | "deduped" | "failed";

  let outcome: DispatchMetricOutcome;
  let eventId: string | null = null;
  let notificationId: string | null = null;
  let stage: DispatchStage | null = null;
  let code: DispatchErrorCode | null = null;
  let errorMsg: string | null = null;

  if (result.ok) {
    switch (result.type) {
      case AppEventType.ASSET_CREATED:
      case AppEventType.ASSET_UPDATED:
        eventId = result.eventId;
        notificationId = result.notificationId ?? null;
        outcome = result.deduped ? "deduped" : "created";
        break;
      case AppEventType.USER_WELCOME:
        eventId = result.eventId;
        notificationId = result.notificationId;
        outcome = "created";
        break;
      case AppEventType.TEST_NOTIFICATION:
        outcome = "created";
        break;
      default: {
        // Exhaustiveness guard — if a new DispatchSuccess variant is added,
        // this line fails to compile, forcing the maintainer to handle it
        // explicitly. Runtime fallback preserved for forward compatibility.
        const _exhaustive: never = result;
        void _exhaustive;
        outcome = "created";
        break;
      }
    }
  } else {
    outcome = "failed";
    stage = result.stage;
    code = result.code ?? null;
    errorMsg = result.error;
  }

  emitDispatchMetric({
    outcome,
    eventType: event.type,
    userId: event.userId,
    eventId,
    dedupeKey: null,
    notificationId,
    latencyMs,
    stage,
    code,
    error: errorMsg,
    route,
    method,
  });

  return result;
};
