import "server-only";

/**
 * Email Event Logging System
 * ==========================
 *
 * Centralized logging for all email-related events.
 * All email operations are logged to Supabase for audit and monitoring.
 */

import { createServiceRoleClient } from "./server";

export type EmailEventType =
  | "verification_sent"
  | "verification_resent"
  | "verification_attempt"
  | "verification_success"
  | "verification_failed"
  | "reminder_sent"
  | "reminder_failed"
  | "password_reset_sent"
  | "magic_link_sent";

type EmailEventLog = {
  event_type: EmailEventType;
  user_id?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
  error_message?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

/**
 * Log an email event to the database
 * Uses service role to bypass RLS
 */
export async function logEmailEvent(event: EmailEventLog): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    const { error } = await supabase.from("email_event_logs").insert({
      event_type: event.event_type,
      user_id: event.user_id ?? null,
      email: event.email ?? null,
      metadata: event.metadata ?? {},
      error_message: event.error_message ?? null,
      ip_address: event.ip_address ?? null,
      user_agent: event.user_agent ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[email-logger] Failed to log email event:", {
        error: error.message,
        event,
      });
    }
  } catch (err) {
    console.error("[email-logger] Exception logging email event:", {
      error: err instanceof Error ? err.message : "Unknown error",
      event,
    });
  }
}

/**
 * Log verification email sent
 */
export async function logVerificationSent(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "verification_sent",
    user_id: userId,
    email,
    metadata,
  });

  console.log("[email-logger] Verification email sent", {
    userId,
    email,
    ts: new Date().toISOString(),
  });
}

/**
 * Log verification email resent
 */
export async function logVerificationResent(
  email: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "verification_resent",
    email,
    metadata,
  });

  console.log("[email-logger] Verification email resent", {
    email,
    ts: new Date().toISOString(),
  });
}

/**
 * Log verification attempt (user clicked link)
 */
export async function logVerificationAttempt(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "verification_attempt",
    user_id: userId,
    email,
    metadata,
  });

  console.log("[email-logger] Verification attempt", {
    userId,
    email,
    ts: new Date().toISOString(),
  });
}

/**
 * Log successful verification
 */
export async function logVerificationSuccess(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "verification_success",
    user_id: userId,
    email,
    metadata,
  });

  console.log("[email-logger] Verification successful", {
    userId,
    email,
    ts: new Date().toISOString(),
  });
}

/**
 * Log failed verification
 */
export async function logVerificationFailure(
  email: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "verification_failed",
    email,
    error_message: errorMessage,
    metadata,
  });

  console.error("[email-logger] Verification failed", {
    email,
    error: errorMessage,
    ts: new Date().toISOString(),
  });
}

/**
 * Log reminder email sent
 */
export async function logReminderSent(
  userId: string,
  email: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "reminder_sent",
    user_id: userId,
    email,
    metadata,
  });

  console.log("[email-logger] Reminder email sent", {
    userId,
    email,
    ts: new Date().toISOString(),
  });
}

/**
 * Log reminder email failed
 */
export async function logReminderFailed(
  userId: string,
  email: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logEmailEvent({
    event_type: "reminder_failed",
    user_id: userId,
    email,
    error_message: errorMessage,
    metadata,
  });

  console.error("[email-logger] Reminder email failed", {
    userId,
    email,
    error: errorMessage,
    ts: new Date().toISOString(),
  });
}
