import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import { buildEmailVerificationPath, buildLoginPath } from "@/lib/supabase/email-verification";

const ROUTE_TAG = "[auth.callback]";

/**
 * Auth Callback Handler
 * 
 * Handles:
 * 1. Email verification (signup/email_change) with code or token_hash
 * 2. OAuth provider callbacks
 * 3. Password recovery redirects
 * 
 * Flow:
 * - Extract code/token_hash from URL
 * - Exchange for session (if code present)
 * - Verify OTP (if token_hash present)
 * - Get user to check email_confirmed_at
 * - Redirect to appropriate destination
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "signup";
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  console.log(`${ROUTE_TAG} Callback received`, {
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type,
    next,
    hasError: Boolean(error),
  });

  // Handle explicit errors from Supabase Auth
  if (error || errorDescription) {
    console.error(`${ROUTE_TAG} Auth error from provider`, { error, errorDescription });
    const errorMessage = errorDescription ?? error ?? "Authentication failed";
    return NextResponse.redirect(
      new URL(buildLoginPath(next, { emailVerificationRequired: true }), request.url)
    );
  }

  const supabase = await createClient();

  // CASE 1: Handle authorization code exchange (PKCE flow for email/OAuth)
  if (code) {
    console.log(`${ROUTE_TAG} Exchanging code for session`);
    
    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(`${ROUTE_TAG} Code exchange failed`, { error: exchangeError.message });
      return NextResponse.redirect(
        new URL(
          buildEmailVerificationPath(null, next, { emailSent: false }) + 
          "&error=invalid_code",
          request.url
        )
      );
    }

    console.log(`${ROUTE_TAG} Code exchange successful`, {
      userId: sessionData.user?.id,
      emailConfirmed: sessionData.user?.email_confirmed_at != null,
    });

    // Check if email is confirmed - if so, redirect to dashboard
    if (sessionData.user?.email_confirmed_at) {
      console.log(`${ROUTE_TAG} Email confirmed, redirecting to dashboard`);
      return NextResponse.redirect(new URL(next, request.url));
    }

    // User exists but email not confirmed - redirect to verification page
    console.log(`${ROUTE_TAG} Email not confirmed, redirecting to verification page`);
    return NextResponse.redirect(
      new URL(
        buildEmailVerificationPath(sessionData.user?.email, next, { emailSent: true }),
        request.url
      )
    );
  }

  // CASE 2: Handle token_hash verification (legacy email confirmation)
  if (tokenHash) {
    console.log(`${ROUTE_TAG} Verifying OTP with token_hash`);

    const allowedTypes = new Set(["signup", "email", "recovery", "invite"]);
    if (!allowedTypes.has(type)) {
      console.error(`${ROUTE_TAG} Invalid verification type`, { type });
      return NextResponse.redirect(
        new URL(
          buildEmailVerificationPath(null, next, { emailSent: false }) + 
          "&error=invalid_type",
          request.url
        )
      );
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email" | "recovery" | "invite",
    });

    if (verifyError) {
      console.error(`${ROUTE_TAG} OTP verification failed`, { error: verifyError.message });
      return NextResponse.redirect(
        new URL(
          buildEmailVerificationPath(null, next, { emailSent: false }) + 
          "&error=invalid_token",
          request.url
        )
      );
    }

    console.log(`${ROUTE_TAG} OTP verification successful`, {
      userId: verifyData.user?.id,
      emailConfirmed: verifyData.user?.email_confirmed_at != null,
    });

    // After successful verification, redirect to login or dashboard
    if (verifyData.user?.email_confirmed_at) {
      console.log(`${ROUTE_TAG} Email confirmed via OTP, redirecting`);
      
      // Check if we have a session - if yes, go to dashboard, else login
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        return NextResponse.redirect(new URL(next, request.url));
      }
      
      return NextResponse.redirect(
        new URL(buildLoginPath(next, { emailVerified: true }), request.url)
      );
    }

    return NextResponse.redirect(
      new URL(
        buildEmailVerificationPath(verifyData.user?.email, next, { emailSent: true }),
        request.url
      )
    );
  }

  // CASE 3: No code or token - check existing session
  console.log(`${ROUTE_TAG} No code/token, checking existing session`);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user?.email_confirmed_at) {
    console.log(`${ROUTE_TAG} User already verified, redirecting to dashboard`);
    return NextResponse.redirect(new URL(next, request.url));
  }

  // No session or not verified - redirect to verification page
  console.log(`${ROUTE_TAG} No verified session, redirecting to verification`);
  return NextResponse.redirect(
    new URL(buildEmailVerificationPath(user?.email, next), request.url)
  );
}
