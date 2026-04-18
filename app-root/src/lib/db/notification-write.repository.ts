import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logApiError } from "@/lib/api/logging";
import {
  DispatchStage,
  DispatchErrorCode,
  type AppEventType,
} from "@/lib/events/app-event";
import { normalizeContext } from "@/lib/mappers/notification-mappers";

/**
 * NOTIFICATION WRITE REPOSITORY
 * ============================================================================
 * All write operations for notification system.
 * - notifications INSERT
 * - automation_events UPSERT
 * - dead_letter_events INSERT
 * - dispatch_app_event RPC
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem";

export type CreateNotificationInput = {
  userId: string;
  eventId: string;
  title: string;
  message: string;
  type: NotificationType;
  source?: string;
  actionHref?: string;
  actionLabel?: string;
  context?: { route?: string; method?: string };
};

export type NotificationResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code: DispatchErrorCode };

export type AutomationTriggerType =
  | "maintenance_7_days"
  | "warranty_30_days"
  | "subscription_due"
  | "service_log_created"
  | "app_event";

export type EnqueueAutomationEventInput = {
  userId: string;
  triggerType: AutomationTriggerType;
  dedupeKey: string;
  actions?: Array<"email" | "push" | "sms">;
  assetId?: string | null;
  ruleId?: string | null;
  serviceLogId?: string | null;
  eventType?: AppEventType | null;
  payload?: Record<string, unknown>;
  runAfter?: string;
  context?: { route?: string; method?: string };
};

export type AutomationEnqueueResult =
  | { ok: true; inserted: boolean; eventId: string }
  | { ok: false; error: string; code: DispatchErrorCode };

export type DispatchAppEventRow = {
  event_id: string | null;
  notification_id: string | null;
  event_inserted: boolean | null;
  notification_created: boolean | null;
};

export type DeadLetterInput = {
  userId: string | null;
  eventType: AppEventType | null;
  dedupeKey: string | null;
  triggerType: string | null;
  stage: DispatchStage;
  code: DispatchErrorCode | null;
  message: string;
  payload: Record<string, unknown>;
  route?: string | null;
  method?: string | null;
};

export type DispatchAppEventParams = {
  p_user_id: string;
  p_dedupe_key: string;
  p_trigger_type: string;
  p_event_type: AppEventType | null;
  p_asset_id: string | null;
  p_rule_id: string | null;
  p_service_log_id: string | null;
  p_actions: string[];
  p_payload: Record<string, unknown>;
  p_run_after: string;
  p_notification_title: string;
  p_notification_message: string;
  p_notification_type: string;
  p_notification_source: string | null;
  p_notification_action_href: string | null;
  p_notification_action_label: string | null;
};

// ---------------------------------------------------------------------------
// notifications INSERT
// ---------------------------------------------------------------------------

export const insertNotification = async (
  adminClient: SupabaseClient,
  input: CreateNotificationInput,
): Promise<NotificationResult> => {
  const { userId, eventId, title, message, type, source, actionHref, actionLabel } = input;
  const { route, method } = normalizeContext(input.context);

  if (!userId?.trim()) {
    return { ok: false, error: "User ID is required", code: DispatchErrorCode.MISSING_USER_ID };
  }
  if (!eventId?.trim()) {
    return { ok: false, error: "eventId is required", code: DispatchErrorCode.MISSING_EVENT_ID };
  }
  if (!title?.trim()) {
    return { ok: false, error: "Title is required", code: DispatchErrorCode.MISSING_TITLE };
  }
  if (!message?.trim()) {
    return { ok: false, error: "Message is required", code: DispatchErrorCode.MISSING_MESSAGE };
  }

  try {
    const row: Record<string, unknown> = {
      user_id: userId,
      event_id: eventId,
      title: title.trim(),
      message: message.trim(),
      type,
      is_read: false,
    };
    if (source) row.source = source;
    if (actionHref) row.action_href = actionHref;
    if (actionLabel) row.action_label = actionLabel;

    const { data, error } = await adminClient
      .from("notifications")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      logApiError({
        route,
        method,
        userId,
        error,
        status: 500,
        message: "Failed to create notification",
        meta: { title, type },
      });
      return {
        ok: false,
        error: `Database error: ${error.message}`,
        code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        error: "No ID returned from insert",
        code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
      };
    }

    return { ok: true, id: data.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiError({
      route,
      method,
      userId,
      error,
      status: 500,
      message: "Exception creating notification",
      meta: { title, type },
    });
    return { ok: false, error: `Exception: ${errorMsg}`, code: DispatchErrorCode.EXCEPTION };
  }
};

// ---------------------------------------------------------------------------
// automation_events UPSERT
// ---------------------------------------------------------------------------

export const upsertAutomationEvent = async (
  adminClient: SupabaseClient,
  input: EnqueueAutomationEventInput,
): Promise<AutomationEnqueueResult> => {
  const { userId, triggerType, dedupeKey } = input;
  const { route, method } = normalizeContext(input.context);

  if (!userId?.trim()) {
    return { ok: false, error: "User ID is required", code: DispatchErrorCode.MISSING_USER_ID };
  }
  if (!dedupeKey?.trim()) {
    return {
      ok: false,
      error: "dedupeKey is required",
      code: DispatchErrorCode.MISSING_DEDUPE_KEY,
    };
  }

  const row = {
    user_id: userId,
    asset_id: input.assetId ?? null,
    rule_id: input.ruleId ?? null,
    service_log_id: input.serviceLogId ?? null,
    trigger_type: triggerType,
    event_type: input.eventType ?? null,
    actions: input.actions ?? [],
    payload: input.payload ?? {},
    dedupe_key: dedupeKey,
    run_after: input.runAfter ?? new Date().toISOString(),
  };

  try {
    const { data, error } = await adminClient
      .from("automation_events")
      .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");

    if (error) {
      logApiError({
        route,
        method,
        userId,
        error,
        status: 500,
        message: "Automation event upsert failed",
        meta: { triggerType, dedupeKey },
      });
      return {
        ok: false,
        error: `Database error: ${error.message}`,
        code: DispatchErrorCode.EVENT_INSERT_FAILED,
      };
    }

    const inserted = Array.isArray(data) && data.length > 0;
    let eventId: string | null = null;

    if (inserted) {
      eventId = (data?.[0]?.id as string | undefined) ?? null;
    } else {
      const existing = await adminClient
        .from("automation_events")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();

      if (existing.error) {
        logApiError({
          route,
          method,
          userId,
          error: existing.error,
          status: 500,
          message: "Failed to resolve existing automation_event id",
          meta: { triggerType, dedupeKey },
        });
        return {
          ok: false,
          error: `Database error: ${existing.error.message}`,
          code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
        };
      }
      eventId = (existing.data?.id as string | undefined) ?? null;
    }

    if (!eventId) {
      return {
        ok: false,
        error: "Could not resolve automation_events.id after upsert",
        code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
      };
    }

    return { ok: true, inserted, eventId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logApiError({
      route,
      method,
      userId,
      error,
      status: 500,
      message: "Exception upserting automation event",
      meta: { triggerType, dedupeKey },
    });
    return { ok: false, error: `Exception: ${errorMsg}`, code: DispatchErrorCode.EXCEPTION };
  }
};

// ---------------------------------------------------------------------------
// dead_letter_events INSERT
// ---------------------------------------------------------------------------

export const recordDeadLetter = async (
  adminClient: SupabaseClient,
  input: DeadLetterInput,
): Promise<void> => {
  try {
    const { error } = await adminClient.from("dead_letter_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      dedupe_key: input.dedupeKey,
      trigger_type: input.triggerType,
      stage: input.stage,
      error_code: input.code,
      error_message: input.message,
      payload: input.payload ?? {},
      route: input.route ?? null,
      method: input.method ?? null,
    });
    void error;
  } catch {
    // Best-effort
  }
};

// ---------------------------------------------------------------------------
// dispatch_app_event RPC
// ---------------------------------------------------------------------------

export const callDispatchAppEvent = async (
  adminClient: SupabaseClient,
  params: DispatchAppEventParams,
): Promise<{ data: unknown; error: Error | null }> => {
  const { data, error } = await adminClient.rpc("dispatch_app_event", params);
  return { data, error: error as Error | null };
};
