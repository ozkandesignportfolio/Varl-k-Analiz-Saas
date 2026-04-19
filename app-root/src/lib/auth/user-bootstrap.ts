/**
 * User Bootstrap - Production Hardened
 *
 * This module handles atomic, idempotent creation of all user-related database records.
 * Designed for SaaS-grade reliability with no duplicate key errors possible.
 *
 * Architecture:
 * - Uses database RPC function for atomic operations
 * - Safe to call multiple times (idempotent)
 * - No orphaned records possible
 * - Partial failures are logged but don't block
 *
 * Records Created:
 * - profiles: User profile and subscription tier
 * - user_consents: GDPR/KVKK compliance tracking
 * - notification_settings: User notification preferences
 * - notifications: Welcome notification (first time only)
 *
 * Error Handling:
 * - Returns structured result (never throws)
 * - Logs technical details internally
 * - User-facing errors are sanitized
 */

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";

const createAdminClient = () => {
  const supabaseUrl = ServerEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing required Supabase environment variables");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export type BootstrapResult =
  | { ok: true; created: boolean; message: string; notificationId?: string | null }
  | { ok: false; error: string; stage: string };

/**
 * Bootstrap all user records after authentication
 *
 * This function is IDEMPOTENT - safe to call multiple times:
 * - First call: Creates all records + welcome notification
 * - Subsequent calls: Updates existing records, no duplicate errors
 *
 * Usage:
 * ```typescript
 * const result = await bootstrapUserRecords({
 *   userId: session.user.id,
 *   email: session.user.email,
 *   acceptedTerms: true
 * });
 *
 * if (!result.ok) {
 *   // Log error but don't block user
 *   console.error("Bootstrap failed:", result.error);
 * }
 * ```
 */
export async function bootstrapUserRecords(input: {
  userId: string;
  email: string;
  acceptedTerms?: boolean;
}): Promise<BootstrapResult> {
  const { userId, acceptedTerms = true } = input;
  const startTime = Date.now();

  console.log("[user-bootstrap] START", {
    userId,
    acceptedTerms,
    timestamp: new Date().toISOString(),
  });

  try {
    const adminClient = createAdminClient();

    // METHOD 1: Use database RPC function (ATOMIC - preferred)
    // This ensures all operations succeed or fail together
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "bootstrap_user_records",
      {
        p_user_id: userId,
        p_accepted_terms: acceptedTerms,
      }
    );

    if (!rpcError && rpcResult?.success) {
      const duration = Date.now() - startTime;
      console.log("[user-bootstrap] SUCCESS (RPC)", {
        userId,
        isNewUser: rpcResult.is_new_user,
        notificationId: rpcResult.welcome_notification_id,
        durationMs: duration,
      });

      return {
        ok: true,
        created: rpcResult.is_new_user ?? false,
        message: rpcResult.is_new_user
          ? "Kullanıcı kayıtları oluşturuldu"
          : "Kullanıcı kayıtları zaten mevcut",
        notificationId: rpcResult.welcome_notification_id,
      };
    }

    // If RPC fails, log and fall back to manual method
    console.warn("[user-bootstrap] RPC_FAILED_FALLING_BACK", {
      userId,
      rpcError: rpcError?.message,
      rpcResult,
    });

    // METHOD 2: Manual upsert operations (for environments without RPC)
    return await bootstrapUserRecordsManual(adminClient, userId, acceptedTerms);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    console.error("[user-bootstrap] CRITICAL_ERROR", {
      userId,
      error: errorMsg,
      durationMs: duration,
    });

    return {
      ok: false,
      error: "Kullanıcı kayıtları oluşturulurken bir hata oluştu. Lütfen sayfayı yenileyin.",
      stage: "unknown",
    };
  }
}

/**
 * Manual bootstrap fallback using individual upsert operations
 * Used when RPC function is not available
 */
async function bootstrapUserRecordsManual(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  acceptedTerms: boolean
): Promise<BootstrapResult> {
  const consentedAt = new Date().toISOString();

  // Check if user already has records (for welcome notification logic)
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  const isNewUser = !existingProfile;

  // Stage 1: Profile (upsert - idempotent)
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(
      { id: userId, plan: "free" },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[user-bootstrap] PROFILE_ERROR", { userId, error: profileError.message });
    return {
      ok: false,
      error: "Profil oluşturulamadı",
      stage: "profile",
    };
  }

  // Stage 2: Notification settings (upsert - idempotent)
  const { error: settingsError } = await adminClient
    .from("notification_settings")
    .upsert(
      { user_id: userId },
      { onConflict: "user_id" }
    );

  if (settingsError) {
    console.error("[user-bootstrap] SETTINGS_ERROR", { userId, error: settingsError.message });
    return {
      ok: false,
      error: "Bildirim ayarları oluşturulamadı",
      stage: "notification_settings",
    };
  }

  // Stage 3: User consents (upsert - idempotent)
  const { error: consentError } = await adminClient
    .from("user_consents")
    .upsert(
      {
        user_id: userId,
        accepted_terms: acceptedTerms,
        consented_at: consentedAt,
      },
      { onConflict: "user_id" }
    );

  if (consentError) {
    console.error("[user-bootstrap] CONSENT_ERROR", { userId, error: consentError.message });
    return {
      ok: false,
      error: "Kullanıcı onayları kaydedilemedi",
      stage: "user_consents",
    };
  }

  // Stage 4: Welcome notification (only for new users) — event contract.
  let notificationId: string | null = null;
  if (isNewUser) {
    const { getNotificationService, AppEventType } = await import("@/lib/notifications");
    const result = await getNotificationService().dispatch(
      { type: AppEventType.USER_WELCOME, userId },
      { route: "user-bootstrap", method: "POST" },
    );

    if (result.ok && result.type === AppEventType.USER_WELCOME) {
      notificationId = result.notificationId;
      console.log("[user-bootstrap] WELCOME_NOTIF_CREATED", { userId, notificationId });
    } else if (!result.ok) {
      // Log but don't fail — notification is not critical.
      console.warn("[user-bootstrap] WELCOME_NOTIF_ERROR", {
        userId,
        error: result.error,
        code: result.code,
      });
    }
  }

  console.log("[user-bootstrap] SUCCESS (MANUAL)", {
    userId,
    isNewUser,
    notificationId,
  });

  return {
    ok: true,
    created: isNewUser,
    message: isNewUser
      ? "Kullanıcı kayıtları oluşturuldu"
      : "Kullanıcı kayıtları zaten mevcut",
    notificationId,
  };
}
