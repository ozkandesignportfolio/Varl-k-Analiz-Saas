import "server-only";

import { randomUUID } from "crypto";
import { DispatchErrorCode, AppEventType } from "@/lib/events/app-event";
import { upsertAutomationEvent } from "@/lib/db/notification-write.repository";
import type { NotificationBatchResult } from "../notification-service";

const SERVICE_TAG = "[test-notification-handler]";

const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(`${SERVICE_TAG} ${event}`, payload);
};

const TEST_RUN_AFTER = "2099-12-31T23:59:59.000Z";

type TestDraft = {
  title: string;
  message: string;
  type: "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem";
  triggerType: "maintenance_7_days" | "warranty_30_days" | "subscription_due" | "service_log_created" | "app_event";
  eventType?: AppEventType;
  createdAt: string;
  actionHref: string;
  payload?: Record<string, unknown>;
};

const buildTestDrafts = (): TestDraft[] => {
  const now = Date.now();
  return [
    {
      title: "Varlık güncellendi",
      message: "Bir varlığınızın bilgileri güncellendi.",
      type: "Sistem",
      triggerType: "service_log_created",
      eventType: AppEventType.ASSET_UPDATED,
      createdAt: new Date(now).toISOString(),
      actionHref: "/assets",
    },
    {
      title: "Bakım zamanı yaklaşıyor",
      message: "Bir varlığınız için bakım tarihi yaklaşıyor.",
      type: "Bakım",
      triggerType: "maintenance_7_days",
      createdAt: new Date(now - 60_000).toISOString(),
      actionHref: "/maintenance",
    },
    {
      title: "Fatura gecikti",
      message: "Bir faturanızın son ödeme tarihi geçti.",
      type: "Ödeme",
      triggerType: "subscription_due",
      createdAt: new Date(now - 120_000).toISOString(),
      actionHref: "/billing",
    },
    {
      title: "Garanti bitmek üzere",
      message: "Bir varlığınızın garanti süresi yakında dolacak.",
      type: "Garanti",
      triggerType: "warranty_30_days",
      createdAt: new Date(now - 180_000).toISOString(),
      actionHref: "/assets",
    },
  ];
};

export const generateTestNotifications = async (
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
): Promise<NotificationBatchResult> => {
  const ctx = { route: "/api/notifications/test", method: "POST" as const };
  const result: NotificationBatchResult = { successful: [], eventIds: [], failed: [] };

  if (!userId?.trim()) {
    result.failed.push({
      error: "User ID is required",
      code: DispatchErrorCode.MISSING_USER_ID,
    });
    return result;
  }

  const drafts = buildTestDrafts();

  for (const draft of drafts) {
    const dedupeKey = `test-notification:${userId}:${draft.triggerType}:${randomUUID()}`;

    const enqueue = await upsertAutomationEvent(adminClient, {
      userId,
      triggerType: draft.triggerType,
      eventType: draft.eventType ?? null,
      dedupeKey,
      assetId: null,
      payload: {
        title: draft.title,
        message: draft.message,
        type: draft.type,
        created_at: draft.createdAt,
        action_href: draft.actionHref,
        is_test_notification: true,
        ...draft.payload,
      },
      runAfter: TEST_RUN_AFTER,
      context: ctx,
    });

    if (!enqueue.ok) {
      result.failed.push({ error: enqueue.error, code: enqueue.code });
      continue;
    }
    result.successful.push(draft.triggerType);
    result.eventIds.push(enqueue.eventId);
  }

  logEvent("TEST_NOTIFICATIONS_COMPLETE", {
    userId,
    successful: result.successful.length,
    failed: result.failed.length,
  });
  return result;
};

export const handleTestNotification = async (
  adminClient: import("@supabase/supabase-js").SupabaseClient,
  event: import("@/lib/events/app-event").TestNotificationEvent,
): Promise<import("@/lib/events/app-event").DispatchResult> => {
  const batch = await generateTestNotifications(adminClient, event.userId);
  return {
    ok: true,
    type: event.type,
    eventIds: batch.eventIds,
    successful: batch.successful.length,
    failed: batch.failed.length,
  };
};
