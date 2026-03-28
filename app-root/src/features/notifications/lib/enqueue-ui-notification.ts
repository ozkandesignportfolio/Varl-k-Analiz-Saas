import "server-only";

import { logApiError } from "@/lib/api/logging";

type UiNotificationKind = "asset_created" | "asset_updated";

type EnqueueUiNotificationParams = {
  route: string;
  method: "POST" | "PATCH";
  userId: string;
  dedupeKey: string;
  kind: UiNotificationKind;
  assetId: string;
  assetName: string;
  payload?: Record<string, unknown>;
};

type LooseAutomationEventsClient = {
  from: (table: "automation_events") => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: { message?: string; code?: string } | null }>;
  };
};

const UI_NOTIFICATION_RUN_AFTER = "2099-12-31T23:59:59.000Z";

export async function enqueueUiNotification(params: EnqueueUiNotificationParams) {
  let automationClient: LooseAutomationEventsClient;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    automationClient = supabaseAdmin as unknown as LooseAutomationEventsClient;
  } catch (error) {
    logApiError({
      route: params.route,
      method: params.method,
      userId: params.userId,
      error,
      status: 500,
      message: "Supabase admin client could not be initialized for UI notification enqueue",
      meta: {
        assetId: params.assetId,
        dedupeKey: params.dedupeKey,
        kind: params.kind,
      },
    });
    return;
  }

  const assetCategory =
    typeof params.payload?.asset_category === "string"
      ? params.payload.asset_category
      : typeof params.payload?.category === "string"
        ? params.payload.category
        : null;

  const sharedPayload = {
    asset_name: params.assetName,
    notification_kind: params.kind,
    action_href: `/assets/${params.assetId}`,
    ...(assetCategory ? { asset_category: assetCategory } : {}),
    ...params.payload,
  };

  const { error: uiError } = await automationClient.from("automation_events").upsert(
    {
      user_id: params.userId,
      asset_id: params.assetId,
      trigger_type: "service_log_created",
      actions: [],
      payload: sharedPayload,
      dedupe_key: `${params.dedupeKey}:ui`,
      run_after: UI_NOTIFICATION_RUN_AFTER,
    },
    {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    },
  );

  if (uiError) {
    logApiError({
      route: params.route,
      method: params.method,
      userId: params.userId,
      error: uiError,
      status: 500,
      message: "UI notification enqueue failed",
      meta: {
        assetId: params.assetId,
        dedupeKey: params.dedupeKey,
        kind: params.kind,
        channel: "in_app",
      },
    });
  }

  const { error: emailError } = await automationClient.from("automation_events").upsert(
    {
      user_id: params.userId,
      asset_id: params.assetId,
      trigger_type: "service_log_created",
      actions: ["email"],
      payload: {
        ...sharedPayload,
        email_only: true,
      },
      dedupe_key: `${params.dedupeKey}:email`,
      run_after: new Date().toISOString(),
    },
    {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    },
  );

  if (emailError) {
    logApiError({
      route: params.route,
      method: params.method,
      userId: params.userId,
      error: emailError,
      status: 500,
      message: "Email notification enqueue failed",
      meta: {
        assetId: params.assetId,
        dedupeKey: params.dedupeKey,
        kind: params.kind,
        channel: "email",
      },
    });
  }
}
