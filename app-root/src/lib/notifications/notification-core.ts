import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertNotification,
  upsertAutomationEvent,
  type CreateNotificationInput,
  type EnqueueAutomationEventInput,
  type AutomationEnqueueResult,
  type NotificationResult,
} from "@/lib/db/notification-write.repository";
import {
  assertNoEventIdentityInPayload,
  isDispatchInvariantError,
} from "@/lib/utils/guards";
import type { NotificationBatchResult } from "./notification-service";

const SERVICE_TAG = "[notification-core]";

const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(`${SERVICE_TAG} ${event}`, payload);
};

export const createNotification = async (
  adminClient: SupabaseClient,
  input: CreateNotificationInput,
): Promise<NotificationResult> => {
  return insertNotification(adminClient, input);
};

export const createBatch = async (
  adminClient: SupabaseClient,
  inputs: CreateNotificationInput[],
): Promise<NotificationBatchResult> => {
  logEvent("BATCH_ATTEMPT", { count: inputs.length });

  const result: NotificationBatchResult = { successful: [], eventIds: [], failed: [] };
  for (const input of inputs) {
    const r = await insertNotification(adminClient, input);
    if (r.ok) {
      result.successful.push(r.id);
      result.eventIds.push(input.eventId);
    } else {
      result.failed.push({ error: r.error, code: r.code });
    }
  }

  logEvent("BATCH_COMPLETE", {
    attempted: inputs.length,
    successful: result.successful.length,
    failed: result.failed.length,
  });
  return result;
};

export const enqueueAutomationEvent = async (
  adminClient: SupabaseClient,
  input: EnqueueAutomationEventInput,
): Promise<AutomationEnqueueResult> => {
  try {
    assertNoEventIdentityInPayload(input.payload);
  } catch (error) {
    if (isDispatchInvariantError(error)) {
      logEvent("AUTOMATION_PAYLOAD_GUARD", { userId: input.userId, dedupeKey: input.dedupeKey, error: (error as Error).message });
      return { ok: false, error: (error as Error).message, code: (error as import("@/lib/utils/guards/notification-guards").DispatchInvariantError).code };
    }
    throw error;
  }
  return upsertAutomationEvent(adminClient, input);
};
