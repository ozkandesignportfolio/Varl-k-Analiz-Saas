import "server-only";

import { randomUUID } from "crypto";
import { logApiError } from "@/lib/api/logging";

export type TestNotificationType = "Bakım" | "Garanti" | "Ödeme" | "Sistem";
export type TestTriggerType = "maintenance_7_days" | "warranty_30_days" | "subscription_due" | "service_log_created";

export type TestNotificationDraft = {
  title: string;
  message: string;
  type: TestNotificationType;
  triggerType: TestTriggerType;
  createdAt: string;
  actionHref: string;
  payload?: Record<string, unknown>;
};

type AutomationEventsInsertClient = {
  from: (table: "automation_events") => {
    insert: (values: Record<string, unknown>[]) => Promise<{ error: { message?: string } | null }>;
  };
};

const TEST_NOTIFICATION_RUN_AFTER = "2099-12-31T23:59:59.000Z";

const buildNotificationDrafts = (): TestNotificationDraft[] => {
  const now = Date.now();

  return [
    {
      title: "Varlık güncellendi",
      message: "Bir varlığınızın bilgileri güncellendi.",
      type: "Sistem",
      triggerType: "service_log_created",
      createdAt: new Date(now).toISOString(),
      actionHref: "/assets",
      payload: {
        notification_kind: "asset_updated",
      },
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

export async function generateTestNotifications(userId: string) {
  const drafts = buildNotificationDrafts();

  let automationClient: AutomationEventsInsertClient;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    automationClient = supabaseAdmin as unknown as AutomationEventsInsertClient;
  } catch (error) {
    logApiError({
      route: "/api/notifications/test",
      method: "POST",
      userId,
      error,
      status: 500,
      message: "Supabase admin client could not be initialized for test notifications",
    });
    throw error;
  }

  const rows = drafts.map((draft) => ({
    user_id: userId,
    asset_id: null,
    rule_id: null,
    service_log_id: null,
    trigger_type: draft.triggerType,
    actions: [],
    payload: {
      title: draft.title,
      message: draft.message,
      type: draft.type,
      created_at: draft.createdAt,
      action_href: draft.actionHref,
      is_test_notification: true,
      ...draft.payload,
    },
    dedupe_key: `test-notification:${userId}:${draft.triggerType}:${randomUUID()}`,
    run_after: TEST_NOTIFICATION_RUN_AFTER,
    created_at: draft.createdAt,
  }));

  const { error } = await automationClient.from("automation_events").insert(rows);

  if (error) {
    logApiError({
      route: "/api/notifications/test",
      method: "POST",
      userId,
      error,
      status: 500,
      message: "Test notifications insert failed",
    });
    throw new Error(error.message ?? "Test notifications insert failed");
  }

  return drafts;
}
