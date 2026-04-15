import { createClient } from "@supabase/supabase-js";
import { bootstrapUserRecords } from "@/lib/auth/user-bootstrap";

/**
 * Auth Callback Route - Production Hardened
 *
 * Flow:
 * 1. Exchange code for session
 * 2. Bootstrap all user records (idempotent)
 * 3. Redirect to dashboard
 *
 * Safety:
 * - Bootstrap can run multiple times without errors
 * - Partial failures are logged but don't block redirect
 * - Service role used for admin operations only
 */
export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const baseUrl = new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  console.log("[auth.callback] START", { requestId, hasCode: Boolean(code) });

  if (!code) {
    console.log("[auth.callback] ERROR missing_code", { requestId });
    return Response.redirect(`${baseUrl}/verify-email?error=missing_code`);
  }

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[auth.callback] ERROR missing_env", {
      requestId,
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(serviceRoleKey),
    });
    return Response.redirect(`${baseUrl}/verify-email?error=server_config`);
  }

  // Create admin client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Exchange code for session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    console.log("[auth.callback] ERROR exchange_failed", {
      requestId,
      error: error?.message || "no_user",
    });
    return Response.redirect(
      `${baseUrl}/verify-email?error=invalid&error_description=${encodeURIComponent(
        error?.message || "Geçersiz veya süresi dolmuş doğrulama kodu"
      )}`
    );
  }

  const user = data.user;
  console.log("[auth.callback] USER_AUTHENTICATED", {
    requestId,
    userId: user.id,
    email: user.email,
    emailConfirmed: user.email_confirmed_at != null,
  });

  // Bootstrap all user records (IDEMPOTENT)
  // This creates: profile, notification_settings, user_consents, welcome notification
  const metadata = user.user_metadata as Record<string, unknown> | null;
  const acceptedTerms =
    metadata?.["legal_consents"] != null
      ? Boolean(
          (metadata["legal_consents"] as Record<string, unknown>)?.["accepted_terms"]
        )
      : true;

  console.log("[auth.callback] BOOTSTRAP_START", {
    requestId,
    userId: user.id,
    acceptedTerms,
  });

  const bootstrapResult = await bootstrapUserRecords({
    userId: user.id,
    email: user.email ?? "",
    acceptedTerms,
  });

  if (!bootstrapResult.ok) {
    // Log but don't block - user is already authenticated
    console.error("[auth.callback] BOOTSTRAP_WARNING", {
      requestId,
      userId: user.id,
      error: bootstrapResult.error,
      stage: bootstrapResult.stage,
    });
    // Continue to redirect - don't block user for bootstrap failure
  } else {
    console.log("[auth.callback] BOOTSTRAP_SUCCESS", {
      requestId,
      userId: user.id,
      created: bootstrapResult.created,
    });
  }

  console.log("[auth.callback] COMPLETE", {
    requestId,
    userId: user.id,
    redirectTo: "/dashboard",
  });

  // Redirect to dashboard
  return Response.redirect(`${baseUrl}/dashboard`);
}

