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

type NotificationsInsertClient = {
  from: (table: "notifications") => {
    insert: (
      values: Record<string, unknown>,
    ) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message?: string; code?: string } | null;
        }>;
      };
    };
  };
};

type LooseAutomationEventsClient = {
  from: (table: "automation_events") => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string; ignoreDuplicates: boolean },
    ) => Promise<{ error: { message?: string; code?: string } | null }>;
  };
};

function buildUiCopy(kind: UiNotificationKind, assetName: string) {
  const safeName = assetName?.trim() || "Varlık";
  if (kind === "asset_created") {
    return {
      title: "Yeni varlık eklendi",
      message: `"${safeName}" varlığı başarıyla oluşturuldu.`,
    };
  }
  return {
    title: "Varlık güncellendi",
    message: `"${safeName}" varlığının bilgileri güncellendi.`,
  };
}

export async function enqueueUiNotification(params: EnqueueUiNotificationParams) {
  let notificationsClient: NotificationsInsertClient;
  let automationClient: LooseAutomationEventsClient;
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    notificationsClient = supabaseAdmin as unknown as NotificationsInsertClient;
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

  // Direct insert into notifications table (UI in-app channel)
  const copy = buildUiCopy(params.kind, params.assetName);
  console.log("NOTIFICATION_UI_INSERT_ATTEMPT", {
    userId: params.userId,
    assetId: params.assetId,
    kind: params.kind,
    title: copy.title,
  });

  const { data: notifData, error: uiError } = await notificationsClient
    .from("notifications")
    .insert({
      user_id: params.userId,
      title: copy.title || "Bildirim",
      message: copy.message || "",
      type: "Sistem",
      is_read: false,
    })
    .select("id")
    .single();

  if (uiError) {
    console.log("NOTIFICATION_UI_INSERT_FAILED", {
      userId: params.userId,
      error: uiError.message,
      code: uiError.code,
    });
    logApiError({
      route: params.route,
      method: params.method,
      userId: params.userId,
      error: uiError,
      status: 500,
      message: "UI notification insert failed",
      meta: {
        assetId: params.assetId,
        dedupeKey: params.dedupeKey,
        kind: params.kind,
        channel: "in_app",
      },
    });
  } else {
    console.log("NOTIFICATION_UI_INSERT_SUCCESS", {
      userId: params.userId,
      notificationId: notifData?.id,
      kind: params.kind,
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
