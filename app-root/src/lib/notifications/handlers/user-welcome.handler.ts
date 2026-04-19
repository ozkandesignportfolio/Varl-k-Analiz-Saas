import "server-only";

import { logApiError } from "@/lib/api/logging";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppEventType,
  DispatchStage,
  DispatchErrorCode,
} from "@/lib/events/app-event";
import {
  recordDeadLetter,
} from "@/lib/db/notification-write.repository";
import { buildDedupeKey } from "@/lib/utils/dedupe";
import { normalizeContext } from "@/lib/mappers/notification-mappers";

export const handleUserWelcome = async (
  adminClient: SupabaseClient,
  event: import("@/lib/events/app-event").UserWelcomeEvent,
  context?: { route?: string; method?: string },
): Promise<import("@/lib/events/app-event").DispatchResult> => {
  const { route, method } = normalizeContext(context);
  const dedupeKey = buildDedupeKey({
    eventType: AppEventType.USER_WELCOME,
    userId: event.userId,
  });

  try {
    const { data, error } = await adminClient.rpc("dispatch_app_event", {
      p_user_id: event.userId,
      p_dedupe_key: dedupeKey,
      p_trigger_type: "app_event",
      p_event_type: AppEventType.USER_WELCOME,
      p_asset_id: null,
      p_rule_id: null,
      p_service_log_id: null,
      p_actions: [],
      p_payload: {},
      p_run_after: new Date().toISOString(),
      p_notification_title: "Hoş geldiniz",
      p_notification_message: "Assetly'ye hoş geldiniz! Bildirim sistemi aktif.",
      p_notification_type: "Sistem",
      p_notification_source: "system",
      p_notification_action_href: "/assets",
      p_notification_action_label: "Varlıklarım",
    });

    if (error) {
      logApiError({
        route,
        method,
        userId: event.userId,
        error,
        status: 500,
        message: "dispatch_app_event RPC failed (USER_WELCOME)",
        meta: { dedupeKey },
      });
      await recordDeadLetter(adminClient, {
        userId: event.userId,
        eventType: AppEventType.USER_WELCOME,
        dedupeKey,
        triggerType: "app_event",
        stage: DispatchStage.PERSIST_EVENT,
        code: DispatchErrorCode.RPC_FAILED,
        message: error.message,
        payload: {},
        route,
        method,
      });
      return {
        ok: false,
        type: event.type,
        error: `Database error: ${error.message}`,
        code: DispatchErrorCode.RPC_FAILED,
        stage: DispatchStage.PERSIST_EVENT,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    const eventId = (row?.event_id as string | undefined) ?? null;
    const notificationId = (row?.notification_id as string | undefined) ?? null;

    if (!eventId || !notificationId) {
      await recordDeadLetter(adminClient, {
        userId: event.userId,
        eventType: AppEventType.USER_WELCOME,
        dedupeKey,
        triggerType: "app_event",
        stage: DispatchStage.PERSIST_EVENT,
        code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
        message: "dispatch_app_event returned incomplete row",
        payload: { eventId, notificationId },
        route,
        method,
      });
      return {
        ok: false,
        type: event.type,
        error: "dispatch_app_event returned incomplete row",
        code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
        stage: DispatchStage.PERSIST_EVENT,
      };
    }

    return {
      ok: true,
      type: event.type,
      eventId,
      notificationId,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    logApiError({
      route,
      method,
      userId: event.userId,
      error: e,
      status: 500,
      message: "Exception in dispatch_app_event (USER_WELCOME)",
      meta: { dedupeKey },
    });
    await recordDeadLetter(adminClient, {
      userId: event.userId,
      eventType: AppEventType.USER_WELCOME,
      dedupeKey,
      triggerType: "app_event",
      stage: DispatchStage.PERSIST_EVENT,
      code: DispatchErrorCode.EXCEPTION,
      message: errorMsg,
      payload: {},
      route,
      method,
    });
    return {
      ok: false,
      type: event.type,
      error: `Exception: ${errorMsg}`,
      code: DispatchErrorCode.EXCEPTION,
      stage: DispatchStage.PERSIST_EVENT,
    };
  }
};
