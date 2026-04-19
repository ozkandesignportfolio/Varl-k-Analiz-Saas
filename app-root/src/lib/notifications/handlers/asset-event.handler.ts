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
  callDispatchAppEvent,
  type DispatchAppEventRow,
} from "@/lib/db/notification-write.repository";
import { resolveDispatchIdentity } from "@/lib/utils/dedupe";
import {
  assertNoEventIdentityInPayload,
  assertValidDispatchInput,
  advanceDispatchStage,
  isDispatchInvariantError,
} from "@/lib/utils/guards";
import { buildAssetUiCopy, normalizeContext } from "@/lib/mappers/notification-mappers";
import type {
  NotifyAssetEventInput,
  NotifyAssetEventResult,
} from "../notification-service";

export const notifyAssetEvent = async (
  adminClient: SupabaseClient,
  input: NotifyAssetEventInput,
): Promise<NotifyAssetEventResult> => {
  const { userId, assetId, eventType } = input;
  const { route, method } = normalizeContext(input.context);
  const dedupeKey = `${input.dedupeKey}:email`;

  const assetCategory =
    typeof input.payload?.asset_category === "string"
      ? input.payload.asset_category
      : typeof input.payload?.category === "string"
        ? input.payload.category
      : null;

  const eventPayload: Record<string, unknown> = {
    asset_name: input.assetName,
    action_href: `/assets/${assetId}`,
    email_only: true,
    ...(assetCategory ? { asset_category: assetCategory } : {}),
    ...input.payload,
  };
  const copy = buildAssetUiCopy(eventType, input.assetName);
  let stage = DispatchStage.VALIDATE;

  try {
    assertValidDispatchInput({
      userId,
      dedupeKey,
      assetId,
      assetName: input.assetName,
      notificationTitle: copy.title,
      notificationMessage: copy.message,
    });
    assertNoEventIdentityInPayload(eventPayload);
    stage = advanceDispatchStage(stage, DispatchStage.PERSIST_EVENT);

    const { data, error } = await callDispatchAppEvent(adminClient, {
      p_user_id: userId,
      p_dedupe_key: dedupeKey,
      p_trigger_type: "service_log_created",
      p_event_type: eventType,
      p_asset_id: assetId ?? null,
      p_rule_id: null,
      p_service_log_id: null,
      p_actions: ["email"],
      p_payload: eventPayload,
      p_run_after: new Date().toISOString(),
      p_notification_title: copy.title,
      p_notification_message: copy.message,
      p_notification_type: "Sistem",
      p_notification_source: null,
      p_notification_action_href: `/assets/${assetId}`,
      p_notification_action_label: null,
    });

    if (error) {
      logApiError({
        route,
        method,
        userId,
        error,
        status: 500,
        message: "dispatch_app_event RPC failed",
        meta: { dedupeKey },
      });
      await recordDeadLetter(adminClient, {
        userId,
        eventType,
        dedupeKey,
        triggerType: "service_log_created",
        stage,
        code: DispatchErrorCode.RPC_FAILED,
        message: error.message,
        payload: eventPayload,
        route,
        method,
      });
      return {
        ok: false,
        error: `Database error: ${error.message}`,
        code: DispatchErrorCode.RPC_FAILED,
        stage: DispatchStage.PERSIST_EVENT,
      };
    }

    const row = (Array.isArray(data) ? data[0] : data) as DispatchAppEventRow | null;
    const eventId = row?.event_id ?? null;
    const notificationId = row?.notification_id ?? null;
    const notificationCreated = Boolean(row?.notification_created);

    if (!eventId) {
      await recordDeadLetter(adminClient, {
        userId,
        eventType,
        dedupeKey,
        triggerType: "service_log_created",
        stage: DispatchStage.PERSIST_EVENT,
        code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
        message: "dispatch_app_event returned no event_id",
        payload: eventPayload,
        route,
        method,
      });
      return {
        ok: false,
        error: "dispatch_app_event returned no event_id",
        code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
        stage: DispatchStage.PERSIST_EVENT,
      };
    }

    stage = advanceDispatchStage(stage, DispatchStage.CREATE_NOTIFICATION);

    if (!notificationId) {
      await recordDeadLetter(adminClient, {
        userId,
        eventType,
        dedupeKey,
        triggerType: "service_log_created",
        stage,
        code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
        message: "dispatch_app_event returned no notification_id",
        payload: eventPayload,
        route,
        method,
      });
      return {
        ok: false,
        error: "dispatch_app_event returned no notification_id",
        code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
        stage,
      };
    }

    stage = advanceDispatchStage(stage, DispatchStage.COMPLETE);

    if (notificationCreated) {
      return { ok: true, deduped: false, eventId, notificationId };
    }
    return { ok: true, deduped: true, eventId };
  } catch (e) {
    if (isDispatchInvariantError(e)) {
      await recordDeadLetter(adminClient, {
        userId,
        eventType,
        dedupeKey,
        triggerType: "service_log_created",
        stage: e.stage,
        code: e.code,
        message: e.message,
        payload: eventPayload,
        route,
        method,
      });
      return {
        ok: false,
        error: e.message,
        code: e.code,
        stage: e.stage,
      };
    }

    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    logApiError({
      route,
      method,
      userId,
      error: e,
      status: 500,
      message: "Exception in notifyAssetEvent",
      meta: { dedupeKey },
    });
    await recordDeadLetter(adminClient, {
      userId,
      eventType,
      dedupeKey,
      triggerType: "service_log_created",
      stage,
      code: DispatchErrorCode.EXCEPTION,
      message: errorMsg,
      payload: eventPayload,
      route,
      method,
    });
    return {
      ok: false,
      error: `Exception: ${errorMsg}`,
      code: DispatchErrorCode.EXCEPTION,
      stage,
    };
  }
};

export const handleAssetCreated = async (
  adminClient: SupabaseClient,
  event: import("@/lib/events/app-event").AssetCreatedEvent,
  context?: { route?: string; method?: string },
): Promise<import("@/lib/events/app-event").DispatchResult> => {
  const { dedupeKey } = resolveDispatchIdentity(event);
  const result = await notifyAssetEvent(adminClient, {
    userId: event.userId,
    eventType: AppEventType.ASSET_CREATED,
    assetId: event.assetId,
    assetName: event.assetName,
    dedupeKey,
    payload: event.payload,
    context,
  });
  if (!result.ok) {
    return {
      ok: false,
      type: event.type,
      error: result.error,
      code: result.code,
      stage: result.stage,
    };
  }
  return {
    ok: true,
    type: event.type,
    eventId: result.eventId,
    deduped: result.deduped,
    notificationId: result.deduped ? undefined : result.notificationId,
  };
};

export const handleAssetUpdated = async (
  adminClient: SupabaseClient,
  event: import("@/lib/events/app-event").AssetUpdatedEvent,
  context?: { route?: string; method?: string },
): Promise<import("@/lib/events/app-event").DispatchResult> => {
  const { dedupeKey } = resolveDispatchIdentity(event);
  const result = await notifyAssetEvent(adminClient, {
    userId: event.userId,
    eventType: AppEventType.ASSET_UPDATED,
    assetId: event.assetId,
    assetName: event.assetName,
    dedupeKey,
    payload: event.payload,
    context,
  });
  if (!result.ok) {
    return {
      ok: false,
      type: event.type,
      error: result.error,
      code: result.code,
      stage: result.stage,
    };
  }
  return {
    ok: true,
    type: event.type,
    eventId: result.eventId,
    deduped: result.deduped,
    notificationId: result.deduped ? undefined : result.notificationId,
  };
};
