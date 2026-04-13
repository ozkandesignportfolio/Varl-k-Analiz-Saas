/**
 * User Bootstrap - Idempotent user record creation
 * 
 * This module handles creation of database records for authenticated users.
 * It is designed to be idempotent - safe to call multiple times.
 * 
 * Rules:
 * - ONLY runs after email is confirmed
 * - Uses upsert for idempotency
 * - Creates: profiles, user_consents, notification_settings, welcome notification
 * - Handles partial states (some records exist, others don't)
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createWelcomeNotification } from "@/lib/notifications/notification-service";

const REQUIRED_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const createAdminClient = () => {
  if (!REQUIRED_ENV.supabaseUrl || !REQUIRED_ENV.serviceRoleKey) {
    throw new Error("Missing required Supabase environment variables");
  }
  return createSupabaseClient(REQUIRED_ENV.supabaseUrl, REQUIRED_ENV.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export type BootstrapResult =
  | { ok: true; created: boolean; message: string }
  | { ok: false; error: string; stage: string };

/**
 * Bootstrap user records after confirmed email
 * - Idempotent: safe to call multiple times
 * - Only creates missing records
 * - Uses upsert with onConflict
 */
export async function bootstrapUserRecords(input: {
  userId: string;
  email: string;
  acceptedTerms?: boolean;
}): Promise<BootstrapResult> {
  const { userId, acceptedTerms = true } = input;

  try {
    const adminClient = createAdminClient();
    const consentedAt = new Date().toISOString();

    // Check if profile already exists
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    const isAlreadyBootstrapped = Boolean(existingProfile);

    // Stage 1: Profile (REQUIRED)
    // Using id as PK (matches auth.users.id)
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        { id: userId, plan: "free" },
        { onConflict: "id" }
      );

    if (profileError && (profileError as { code?: string }).code !== "23505") {
      return {
        ok: false,
        error: `Profile creation failed: ${profileError.message}`,
        stage: "profile",
      };
    }

    // Stage 2: Notification settings (REQUIRED)
    const { error: notificationError } = await adminClient
      .from("notification_settings")
      .upsert(
        { user_id: userId },
        { onConflict: "user_id" }
      );

    if (notificationError && (notificationError as { code?: string }).code !== "23505") {
      return {
        ok: false,
        error: `Notification settings creation failed: ${notificationError.message}`,
        stage: "notification_settings",
      };
    }

    // Stage 3: User consents (REQUIRED)
    // user_id is PK - upsert handles duplicates gracefully
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

    if (consentError && (consentError as { code?: string }).code !== "23505") {
      return {
        ok: false,
        error: `User consents creation failed: ${consentError.message}`,
        stage: "user_consents",
      };
    }

    // Stage 4: Welcome notification (only for new users)
    if (!isAlreadyBootstrapped) {
      console.log("NOTIFICATION_CREATE_ATTEMPT", {
        userId,
        type: "welcome",
        stage: "user_bootstrap",
      });

      const welcomeResult = await createWelcomeNotification(userId);

      if (!welcomeResult.ok) {
        // Log but don't fail - notification is not critical for signup
        console.log("NOTIFICATION_CREATE_FAILED", {
          userId,
          type: "welcome",
          error: welcomeResult.error,
          stage: "user_bootstrap",
        });
        // Continue - don't block signup for notification failure
      } else {
        console.log("NOTIFICATION_CREATE_SUCCESS", {
          userId,
          notificationId: welcomeResult.id,
          type: "welcome",
          stage: "user_bootstrap",
        });
      }
    }

    return {
      ok: true,
      created: !isAlreadyBootstrapped,
      message: isAlreadyBootstrapped
        ? "User records already exist"
        : "User records created successfully",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      error: `Bootstrap failed: ${errorMsg}`,
      stage: "unknown",
    };
  }
}
