import "server-only";

import { logApiError } from "@/lib/api/logging";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type NotificationType = "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem" | "info";

export type CreateNotificationParams = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  route?: string;
  method?: string;
};

export type NotificationResult =
  | { ok: true; id: string; message: string }
  | { ok: false; error: string; code?: string };

const SERVICE_TAG = "[notification-service]";

/**
 * Create a notification for a user
 * Logs: NOTIFICATION_CREATE_ATTEMPT, NOTIFICATION_CREATE_SUCCESS, NOTIFICATION_CREATE_FAILED
 */
export async function createNotification(params: CreateNotificationParams): Promise<NotificationResult> {
  const {
    userId,
    title,
    message,
    type,
    route = "unknown",
    method = "POST",
  } = params;

  // Log attempt
  console.log("NOTIFICATION_CREATE_ATTEMPT", {
    userId,
    title,
    type,
    route,
  });

  try {
    // Validate required fields
    if (!userId?.trim()) {
      const error = "User ID is required";
      console.log("NOTIFICATION_CREATE_FAILED", {
        userId,
        error,
        code: "missing_user_id",
        route,
      });
      return { ok: false, error, code: "missing_user_id" };
    }

    if (!title?.trim()) {
      const error = "Title is required";
      console.log("NOTIFICATION_CREATE_FAILED", {
        userId,
        error,
        code: "missing_title",
        route,
      });
      return { ok: false, error, code: "missing_title" };
    }

    if (!message?.trim()) {
      const error = "Message is required";
      console.log("NOTIFICATION_CREATE_FAILED", {
        userId,
        error,
        code: "missing_message",
        route,
      });
      return { ok: false, error, code: "missing_message" };
    }

    // Insert notification using admin client (SERVICE ROLE)
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        title: title.trim(),
        message: message.trim(),
        type,
        is_read: false,
      })
      .select("id")
      .single();

    console.log("NOTIFICATION_INSERT_RESULT", { data, error });

    if (error) {
      console.log("NOTIFICATION_CREATE_FAILED", {
        userId,
        error: error.message,
        code: error.code,
        route,
      });

      logApiError({
        route,
        method,
        userId,
        error,
        status: 500,
        message: "Failed to create notification",
        meta: {
          title,
          type,
        },
      });

      return {
        ok: false,
        error: `Database error: ${error.message}`,
        code: error.code,
      };
    }

    if (!data?.id) {
      const error = "No ID returned from insert";
      console.log("NOTIFICATION_CREATE_FAILED", {
        userId,
        error,
        code: "no_id_returned",
        route,
      });
      return { ok: false, error, code: "no_id_returned" };
    }

    // Log success with payload info
    console.log("NOTIFICATION_CREATE_SUCCESS", {
      userId,
      notificationId: data.id,
      title,
      type,
      route,
      payload: { user_id: userId, title, message, type },
    });

    return {
      ok: true,
      id: data.id,
      message: "Notification created successfully",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.log("NOTIFICATION_CREATE_FAILED", {
      userId,
      error: errorMsg,
      code: "exception",
      route,
    });

    logApiError({
      route,
      method,
      userId,
      error,
      status: 500,
      message: "Exception creating notification",
      meta: {
        title,
        type,
      },
    });

    return {
      ok: false,
      error: `Exception: ${errorMsg}`,
      code: "exception",
    };
  }
}

/**
 * Create welcome notification for new users
 * Called after email confirmation
 */
export async function createWelcomeNotification(userId: string): Promise<NotificationResult> {
  console.log("NOTIFICATION_CREATE_ATTEMPT", {
    userId,
    type: "welcome",
    route: "user-bootstrap",
  });

  return createNotification({
    userId,
    title: "Assetly'e Hoş Geldiniz!",
    message: "Hesabınız başarıyla oluşturuldu. Varlıklarınızı eklemeye başlayabilirsiniz.",
    type: "Sistem",
    route: "user-bootstrap",
    method: "POST",
  });
}

/**
 * Create notification for asset creation
 */
export async function createAssetCreatedNotification(
  userId: string,
  assetId: string,
  assetName: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    title: "Yeni Varlık Eklendi",
    message: `"${assetName}" varlığı başarıyla oluşturuldu.`,
    type: "Sistem",
    route: "/api/assets",
    method: "POST",
  });
}

/**
 * Create notification for asset update
 */
export async function createAssetUpdatedNotification(
  userId: string,
  assetId: string,
  assetName: string
): Promise<NotificationResult> {
  return createNotification({
    userId,
    title: "Varlık Güncellendi",
    message: `"${assetName}" varlığının bilgileri güncellendi.`,
    type: "Sistem",
    route: "/api/assets",
    method: "PATCH",
  });
}

/**
 * Batch create notifications (for bulk operations)
 * Logs individual results
 */
export async function batchCreateNotifications(
  params: CreateNotificationParams[]
): Promise<{ successful: string[]; failed: number }> {
  const successful: string[] = [];
  let failed = 0;

  console.log("NOTIFICATION_BATCH_CREATE_ATTEMPT", {
    count: params.length,
  });

  for (const param of params) {
    const result = await createNotification(param);
    if (result.ok) {
      successful.push(result.id);
    } else {
      failed++;
    }
  }

  console.log("NOTIFICATION_BATCH_CREATE_COMPLETE", {
    attempted: params.length,
    successful: successful.length,
    failed,
  });

  return { successful, failed };
}
