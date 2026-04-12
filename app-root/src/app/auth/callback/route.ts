import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ROUTE_TAG = "[auth.callback]";

/**
 * Auth Callback Handler - Single source of truth for email verification
 *
 * Handles:
 * - PKCE code exchange (modern email/OAuth flow)
 *
 * Redirect Rules (STRICT - deterministic):
 * 1. Session exists → /dashboard
 * 2. ELSE IF email_confirmed_at IS NOT NULL → /login?email_verified=1
 * 3. ELSE → /verify-email
 *
 * NOTE: No client-side verification logic. ALL verification happens here.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  console.log(`${ROUTE_TAG} Callback received`, {
    hasCode: Boolean(code),
    next,
    hasError: Boolean(error),
  });

  // Handle explicit errors from Supabase Auth (e.g., OAuth errors)
  if (error || errorDescription) {
    console.error(`${ROUTE_TAG} Auth error from provider`, { error, errorDescription });
    const params = new URLSearchParams();
    params.set("error", "invalid_or_expired");
    if (errorDescription) params.set("error_description", errorDescription);
    return NextResponse.redirect(new URL(`/verify-email?${params.toString()}`, origin));
  }

  // No code provided - invalid request
  if (!code) {
    console.error(`${ROUTE_TAG} No code provided`);
    return NextResponse.redirect(new URL(`/verify-email?error=invalid_or_expired`, origin));
  }

  const supabase = await createClient();

  // PKCE code exchange (modern flow - single source of truth)
  console.log(`${ROUTE_TAG} Exchanging code for session (PKCE)`);

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error(`${ROUTE_TAG} Code exchange failed`, { error: exchangeError.message });
    return NextResponse.redirect(new URL(`/verify-email?error=invalid_or_expired`, origin));
  }

  console.log(`${ROUTE_TAG} Code exchange successful`, {
    userId: sessionData.user?.id,
    emailConfirmed: sessionData.user?.email_confirmed_at != null,
    hasSession: !!sessionData.session,
  });

  // STRICT REDIRECT LOGIC - use sessionData directly (no race condition)
  return handlePostVerificationRedirect(sessionData, origin, next);
}

/**
 * Handle redirect after verification based on session state
 * Uses sessionData from exchangeCodeForSession directly (NO getSession call)
 *
 * Rules (STRICT):
 * 1. Session exists → /dashboard
 * 2. ELSE IF email_confirmed_at IS NOT NULL → /login?email_verified=1
 * 3. ELSE → /verify-email
 */
function handlePostVerificationRedirect(
  sessionData: { session: any; user: any },
  origin: string,
  next: string
) {
  const session = sessionData.session;
  const user = sessionData.user;
  const emailConfirmed = user?.email_confirmed_at != null;
  const email = user?.email;

  console.log(`${ROUTE_TAG} Post-verification state`, {
    hasSession: !!session,
    hasUser: !!user,
    emailConfirmed,
    email,
  });

  // Rule 1: Session exists → /dashboard (user is logged in)
  if (session) {
    console.log(`${ROUTE_TAG} Active session, redirecting to dashboard`);
    return NextResponse.redirect(new URL(next, origin));
  }

  // Rule 2: Email verified but no session → /login?email_verified=1
  if (emailConfirmed) {
    console.log(`${ROUTE_TAG} Email verified, no session, redirecting to login`);
    const params = new URLSearchParams();
    params.set("email_verified", "1");
    if (email) params.set("email", email);
    if (next !== "/dashboard") params.set("next", next);
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, origin));
  }

  // Rule 3: No verified session → /verify-email
  console.log(`${ROUTE_TAG} No verified session, redirecting to verify-email`);
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (next !== "/dashboard") params.set("next", next);
  return NextResponse.redirect(new URL(`/verify-email?${params.toString()}`, origin));
}
