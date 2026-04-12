import "server-only";

import { NextResponse } from "next/server";
import type { createServerClient } from "./server";
import { isEmailConfirmed, classifyAuthError } from "./errors";
import {
  logVerificationAttempt,
  logVerificationSuccess,
  logVerificationFailure,
} from "./email-logger";

/**
 * Verification Handlers
 * =====================
 *
 * Centralized verification logic for the auth callback route.
 */

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Exchange PKCE code for session
 */
export async function exchangeCodeForSession(
  supabase: SupabaseClient,
  code: string
): Promise<
  | { success: true; user: NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["exchangeCodeForSession"]>>["data"]["user"]> }
  | { success: false; error: string }
> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorClassification = classifyAuthError(error);
    return { success: false, error: errorClassification };
  }

  if (!data.user) {
    return { success: false, error: "no_user" };
  }

  return { success: true, user: data.user };
}

/**
 * Verify OTP token (legacy flow fallback)
 */
export async function verifyOtpToken(
  supabase: SupabaseClient,
  tokenHash: string,
  type: "signup" | "email" | "recovery" | "invite"
): Promise<
  | { success: true; user: NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["verifyOtp"]>>["data"]["user"]> }
  | { success: false; error: string }
> {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    const errorClassification = classifyAuthError(error);
    return { success: false, error: errorClassification };
  }

  if (!data.user) {
    return { success: false, error: "no_user" };
  }

  return { success: true, user: data.user };
}

/**
 * Handle redirect after verification
 * This is the SINGLE source of truth for post-verification redirects
 *
 * Rules:
 * 1. Session exists + email confirmed → /dashboard
 * 2. Email confirmed but no session → /login?email_verified=1
 * 3. No verified session → /verify-email?error=invalid_or_expired
 */
export async function handlePostVerificationRedirect(
  supabase: SupabaseClient,
  request: Request,
  next: string = "/dashboard",
  email?: string
): Promise<NextResponse> {
  // Get fresh session and user state
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  const session = sessionData.session;
  const user = userData.user;
  const emailConfirmed = user ? isEmailConfirmed(user) : false;
  const effectiveEmail = email ?? user?.email;

  // Log the verification state
  console.log("[auth.verify] Post-verification state:", {
    hasSession: !!session,
    hasUser: !!user,
    emailConfirmed,
    email: effectiveEmail,
  });

  // RULE 1: Session exists + email confirmed → /dashboard (user is logged in)
  if (session && emailConfirmed) {
    // Log success
    if (user) {
      await logVerificationSuccess(user.id, user.email ?? effectiveEmail ?? "unknown");
    }

    console.log("[auth.verify] Active verified session, redirecting to:", next);
    return NextResponse.redirect(new URL(next, request.url));
  }

  // RULE 2: Email confirmed but no session → /login?email_verified=1
  if (emailConfirmed) {
    console.log("[auth.verify] Email verified, no session, redirecting to login");
    const params = new URLSearchParams();
    params.set("email_verified", "1");
    if (effectiveEmail) params.set("email", effectiveEmail);
    if (next !== "/dashboard") params.set("next", next);

    return NextResponse.redirect(
      new URL(`/login?${params.toString()}`, request.url)
    );
  }

  // RULE 3: No verified session → /verify-email with error
  console.log("[auth.verify] No verified session, redirecting to verify-email");

  // Log failure
  if (effectiveEmail) {
    await logVerificationFailure(
      effectiveEmail,
      "Email not confirmed or session missing"
    );
  }

  const params = new URLSearchParams();
  params.set("error", "invalid_or_expired");
  if (effectiveEmail) params.set("email", effectiveEmail);
  if (next !== "/dashboard") params.set("next", next);

  return NextResponse.redirect(
    new URL(`/verify-email?${params.toString()}`, request.url)
  );
}

/**
 * Log verification attempt from callback
 */
export async function logCallbackAttempt(
  userId: string,
  email: string,
  method: "pkce" | "otp"
): Promise<void> {
  await logVerificationAttempt(userId, email, {
    method,
    source: "auth_callback",
  });
}
