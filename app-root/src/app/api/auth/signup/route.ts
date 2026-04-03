import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { assessSignupRisk } from "@/lib/auth/signup-risk";
import { insertUserConsent, logAuthSecurityEvent } from "@/lib/auth/signup-security";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import {
  isUpstashRedisConfigured,
  takeSlidingWindowRateLimit,
} from "@/lib/auth/upstash-rate-limit";
import { getRequestIp } from "@/lib/api/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isEmailRateLimitError,
  isSupabaseUserEmailConfirmed,
  isUserAlreadyRegisteredError,
} from "@/lib/supabase/auth-errors";
import {
  EMAIL_ALREADY_EXISTS_ERROR,
  EMAIL_CONFIRMATION_DISABLED_ERROR,
  EMAIL_RATE_LIMITED_ERROR,
  INVALID_EMAIL_ERROR,
  INVALID_PASSWORD_ERROR,
  INVALID_REDIRECT_URL_ERROR,
  KVKK_CONSENT_REQUIRED_ERROR,
  normalizeEmail,
  PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
  RATE_LIMITED_ERROR,
  RATE_LIMITER_UNAVAILABLE_ERROR,
  SIGNUP_FAILED_ERROR,
  TERMS_NOT_ACCEPTED_ERROR,
  TURNSTILE_INVALID_ERROR,
  TURNSTILE_REQUIRED_ERROR,
  TURNSTILE_UNAVAILABLE_ERROR,
  type SignupApiErrorResponse,
  type SignupApiSuccessResponse,
  type SignupRisk,
} from "@/lib/supabase/signup";

export const runtime = "nodejs";

const SIGNUP_IP_RATE_LIMIT_CAPACITY = 5;
const SIGNUP_EMAIL_RATE_LIMIT_CAPACITY = 3;
const SIGNUP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const PASSWORD_MIN_LENGTH = 8;

type SignupRequestBody = {
  acceptedKvkk?: unknown;
  acceptedPrivacyPolicy?: unknown;
  acceptedTerms?: unknown;
  deviceFingerprint?: unknown;
  email?: unknown;
  emailRedirectTo?: unknown;
  fullName?: unknown;
  password?: unknown;
  turnstileToken?: unknown;
};

const notificationPreferences = {
  document: true,
  documentExpiry: true,
  document_email: true,
  document_expiry: true,
  document_expiry_email: true,
  email: true,
  frequency: "Aninda",
  inApp: true,
  in_app: true,
  maintenance: true,
  maintenance_email: true,
  payment: true,
  service: true,
  service_email: true,
  service_log: true,
  service_logs: true,
  subscription_email: true,
  system: true,
  warranty: true,
  warranty_email: true,
};

const getRequiredEnv = (key: "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "NEXT_PUBLIC_SUPABASE_URL") => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const getSignUpClient = () => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const buildRiskMetadata = (risk: SignupRisk) => ({
  risk_level: risk.level,
  risk_reasons: risk.reasons,
  risk_score: risk.score,
  risk_signals: risk.signals,
});

const buildErrorResponse = (
  error: string,
  message: string,
  status: number,
  risk?: SignupRisk,
  headers?: HeadersInit,
) =>
  NextResponse.json<SignupApiErrorResponse>(
    {
      error,
      message,
      ok: false,
      ...(risk ? { risk } : {}),
    },
    {
      headers,
      status,
    },
  );

const buildSuccessResponse = (risk: SignupRisk) =>
  NextResponse.json<SignupApiSuccessResponse>(
    {
      ok: true,
      risk,
    },
    { status: 200 },
  );

const getAllowedRedirectOrigins = (request: Request) => {
  const origins = new Set<string>();

  for (const value of [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, request.url]) {
    if (!value?.trim()) {
      continue;
    }

    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed env values and rely on the request origin.
    }
  }

  return origins;
};

const isAllowedEmailRedirect = (redirectTo: string, request: Request) => {
  try {
    const url = new URL(redirectTo);
    return getAllowedRedirectOrigins(request).has(url.origin);
  } catch {
    return false;
  }
};

const isUpstashError = (error: unknown) =>
  error instanceof Error && error.message.toLowerCase().includes("upstash");

export async function POST(request: Request) {
  const requestIp = getRequestIp(request);
  const requestUserAgent = request.headers.get("user-agent")?.trim() || null;

  try {
    const body = (await request.json()) as SignupRequestBody;
    const acceptedTerms = body.acceptedTerms === true;
    const acceptedPrivacyPolicy = body.acceptedPrivacyPolicy === true;
    const acceptedKvkk = body.acceptedKvkk === true;
    const fullName = isNonEmptyString(body.fullName) ? body.fullName.trim() : "";
    const email = isNonEmptyString(body.email) ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const emailRedirectTo = isNonEmptyString(body.emailRedirectTo) ? body.emailRedirectTo.trim() : "";
    const turnstileToken = isNonEmptyString(body.turnstileToken) ? body.turnstileToken.trim() : "";
    const deviceFingerprint = isNonEmptyString(body.deviceFingerprint) ? body.deviceFingerprint.trim() : "";
    const normalizedEmail = email ? normalizeEmail(email) : "";

    const securityEventBase = {
      email: normalizedEmail || null,
      ip: requestIp,
      userAgent: requestUserAgent,
    };

    const buildRisk = async (input: {
      emailRateLimited?: boolean;
      ipRateLimited?: boolean;
      outcome: string;
      turnstileErrorCodes?: string[];
      turnstileVerified?: boolean;
    }) =>
      assessSignupRisk({
        deviceFingerprint,
        email: normalizedEmail,
        ip: requestIp,
        outcome: input.outcome,
        rateLimit: {
          emailTriggered: input.emailRateLimited ?? false,
          ipTriggered: input.ipRateLimited ?? false,
        },
        turnstile: {
          errorCodes: input.turnstileErrorCodes ?? [],
          tokenPresent: Boolean(turnstileToken),
          verified: input.turnstileVerified ?? Boolean(turnstileToken),
        },
        userAgent: requestUserAgent,
      });

    const fail = async (input: {
      error: string;
      eventType: string;
      headers?: HeadersInit;
      message: string;
      metadata?: Record<string, unknown>;
      status: number;
      turnstileErrorCodes?: string[];
      turnstileVerified?: boolean;
      triggeredEmailRateLimit?: boolean;
      triggeredIpRateLimit?: boolean;
      userId?: string | null;
    }) => {
      const risk = await buildRisk({
        emailRateLimited: input.triggeredEmailRateLimit,
        ipRateLimited: input.triggeredIpRateLimit,
        outcome: input.eventType,
        turnstileErrorCodes: input.turnstileErrorCodes,
        turnstileVerified: input.turnstileVerified,
      });

      await logAuthSecurityEvent({
        ...securityEventBase,
        eventType: input.eventType,
        metadata: {
          ...(input.metadata ?? {}),
          ...buildRiskMetadata(risk),
        },
        userId: input.userId ?? null,
      });

      return buildErrorResponse(input.error, input.message, input.status, risk, input.headers);
    };

    if (!isUpstashRedisConfigured()) {
      await logAuthSecurityEvent({
        ...securityEventBase,
        eventType: "signup_rate_limiter_unavailable",
      });

      return buildErrorResponse(
        RATE_LIMITER_UNAVAILABLE_ERROR,
        "Signup is temporarily unavailable. Please try again later.",
        503,
      );
    }

    if (!email || !password || !emailRedirectTo) {
      return fail({
        error: SIGNUP_FAILED_ERROR,
        eventType: "signup_missing_required_fields",
        message: "Email, password, and email redirect URL are required.",
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    if (!isAllowedEmailRedirect(emailRedirectTo, request)) {
      return fail({
        error: INVALID_REDIRECT_URL_ERROR,
        eventType: "signup_invalid_redirect_url",
        message: "Invalid email redirect URL.",
        metadata: {
          email_redirect_to: emailRedirectTo,
        },
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalizedEmail);
    if (!emailLooksValid) {
      return fail({
        error: INVALID_EMAIL_ERROR,
        eventType: "signup_invalid_email",
        message: "Invalid email address.",
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return fail({
        error: INVALID_PASSWORD_ERROR,
        eventType: "signup_invalid_password",
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    if (!acceptedTerms) {
      return fail({
        error: TERMS_NOT_ACCEPTED_ERROR,
        eventType: "signup_missing_terms_consent",
        message: "Terms of Service consent is required.",
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    if (!acceptedPrivacyPolicy) {
      return fail({
        error: PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
        eventType: "signup_missing_privacy_policy_consent",
        message: "Privacy Policy consent is required.",
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    if (!acceptedKvkk) {
      return fail({
        error: KVKK_CONSENT_REQUIRED_ERROR,
        eventType: "signup_missing_kvkk_consent",
        message: "KVKK consent is required.",
        status: 400,
        turnstileVerified: Boolean(turnstileToken),
      });
    }

    if (!turnstileToken) {
      return fail({
        error: TURNSTILE_REQUIRED_ERROR,
        eventType: "signup_turnstile_missing",
        message: "Turnstile verification is required.",
        status: 400,
        turnstileVerified: false,
      });
    }

    const ipRateLimit = await takeSlidingWindowRateLimit({
      limit: SIGNUP_IP_RATE_LIMIT_CAPACITY,
      scope: "auth_signup_ip",
      subject: requestIp,
      windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return fail({
        error: RATE_LIMITED_ERROR,
        eventType: "signup_rate_limited_ip",
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(ipRateLimit.retryAfterMs / 1_000))),
        },
        message: "Too many signup attempts from this IP address.",
        metadata: {
          limit: SIGNUP_IP_RATE_LIMIT_CAPACITY,
          retry_after_ms: ipRateLimit.retryAfterMs,
          scope: "ip",
          window_ms: SIGNUP_RATE_LIMIT_WINDOW_MS,
        },
        status: 429,
        triggeredIpRateLimit: true,
        turnstileVerified: true,
      });
    }

    const emailRateLimit = await takeSlidingWindowRateLimit({
      limit: SIGNUP_EMAIL_RATE_LIMIT_CAPACITY,
      scope: "auth_signup_email",
      subject: normalizedEmail,
      windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return fail({
        error: EMAIL_RATE_LIMITED_ERROR,
        eventType: "signup_rate_limited_email",
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(emailRateLimit.retryAfterMs / 1_000))),
        },
        message: "Too many signup attempts for this email address.",
        metadata: {
          limit: SIGNUP_EMAIL_RATE_LIMIT_CAPACITY,
          retry_after_ms: emailRateLimit.retryAfterMs,
          scope: "email",
          window_ms: SIGNUP_RATE_LIMIT_WINDOW_MS,
        },
        status: 429,
        triggeredEmailRateLimit: true,
        turnstileVerified: true,
      });
    }

    const turnstileVerification = await verifyTurnstileToken({
      remoteIp: requestIp,
      token: turnstileToken,
    });

    if (!turnstileVerification.ok && turnstileVerification.reason !== "invalid") {
      return fail({
        error: TURNSTILE_UNAVAILABLE_ERROR,
        eventType: "signup_turnstile_unavailable",
        message: "Turnstile verification is currently unavailable.",
        metadata: {
          turnstile_error_codes: turnstileVerification.errorCodes,
        },
        status: 503,
        turnstileErrorCodes: turnstileVerification.errorCodes,
        turnstileVerified: false,
      });
    }

    if (!turnstileVerification.ok) {
      return fail({
        error: TURNSTILE_INVALID_ERROR,
        eventType: "signup_turnstile_invalid",
        message: "Turnstile verification failed.",
        metadata: {
          turnstile_error_codes: turnstileVerification.errorCodes,
        },
        status: 403,
        turnstileErrorCodes: turnstileVerification.errorCodes,
        turnstileVerified: false,
      });
    }

    const signUpClient = getSignUpClient();
    const consentedAt = new Date().toISOString();
    const userMetadata: Record<string, unknown> = {
      legal_consents: {
        accepted_kvkk: true,
        accepted_privacy_policy: true,
        accepted_terms: true,
        consented_at: consentedAt,
      },
      notification_preferences: notificationPreferences,
    };

    if (fullName) {
      userMetadata.full_name = fullName;
    }

    const { data, error } = await signUpClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: userMetadata,
        emailRedirectTo,
      },
    });

    if (error) {
      if (isUserAlreadyRegisteredError(error)) {
        return fail({
          error: EMAIL_ALREADY_EXISTS_ERROR,
          eventType: "signup_user_already_exists",
          message: "A user with this email address already exists.",
          metadata: {
            auth_error_code: error.code ?? null,
            auth_error_message: error.message ?? null,
            auth_error_status: error.status ?? null,
          },
          status: 409,
          turnstileVerified: true,
        });
      }

      if (isEmailRateLimitError(error)) {
        return fail({
          error: EMAIL_RATE_LIMITED_ERROR,
          eventType: "signup_supabase_email_rate_limited",
          message: "Supabase email rate limit exceeded.",
          metadata: {
            auth_error_code: error.code ?? null,
            auth_error_message: error.message ?? null,
            auth_error_status: error.status ?? null,
          },
          status: 429,
          triggeredEmailRateLimit: true,
          turnstileVerified: true,
        });
      }

      return fail({
        error: SIGNUP_FAILED_ERROR,
        eventType: "signup_supabase_error",
        message: error.message || "Signup failed.",
        metadata: {
          auth_error_code: error.code ?? null,
          auth_error_message: error.message ?? null,
          auth_error_status: error.status ?? null,
        },
        status: 400,
        turnstileVerified: true,
      });
    }

    if (!data.user?.id) {
      return fail({
        error: SIGNUP_FAILED_ERROR,
        eventType: "signup_missing_user_id",
        message: "Signup failed to return a valid user record.",
        status: 500,
        turnstileVerified: true,
      });
    }

    try {
      await insertUserConsent({
        acceptedKvkk: true,
        acceptedPrivacyPolicy: true,
        acceptedTerms: true,
        consentedAt,
        email: normalizedEmail,
        ip: requestIp,
        userAgent: requestUserAgent,
        userId: data.user.id,
      });
    } catch (error) {
      const cleanup = await supabaseAdmin.auth.admin.deleteUser(data.user.id).catch((cleanupError) => ({
        error: cleanupError,
      }));

      return fail({
        error: SIGNUP_FAILED_ERROR,
        eventType: "signup_consent_log_failed",
        message: "Failed to record consent.",
        metadata: {
          consent_log_error: error instanceof Error ? error.message : "unknown_error",
          user_cleanup_error:
            cleanup && "error" in cleanup && cleanup.error instanceof Error ? cleanup.error.message : null,
        },
        status: 500,
        turnstileVerified: true,
        userId: data.user.id,
      });
    }

    if (data.session && isSupabaseUserEmailConfirmed(data.user)) {
      return fail({
        error: EMAIL_CONFIRMATION_DISABLED_ERROR,
        eventType: "signup_email_confirmation_disabled",
        message: "Email confirmation must remain enabled for this signup flow.",
        status: 409,
        turnstileVerified: true,
        userId: data.user.id,
      });
    }

    const risk = await buildRisk({
      outcome: "signup_success",
      turnstileVerified: true,
    });

    await logAuthSecurityEvent({
      ...securityEventBase,
      eventType: "signup_success",
      metadata: {
        email_confirmation_required: !isSupabaseUserEmailConfirmed(data.user),
        ...buildRiskMetadata(risk),
      },
      userId: data.user.id,
    });

    return buildSuccessResponse(risk);
  } catch (error) {
    console.error("[auth.signup] Failed to create signup.", error);

    const isRedisFailure = isUpstashError(error);
    const errorCode = isRedisFailure ? RATE_LIMITER_UNAVAILABLE_ERROR : SIGNUP_FAILED_ERROR;
    const status = isRedisFailure ? 503 : 500;
    const message = isRedisFailure
      ? "Signup is temporarily unavailable. Please try again later."
      : "Unexpected error while creating signup.";

    await logAuthSecurityEvent({
      email: null,
      eventType: isRedisFailure ? "signup_rate_limiter_unavailable" : "signup_unhandled_error",
      ip: requestIp,
      metadata: {
        error_message: error instanceof Error ? error.message : "unknown_error",
      },
      userAgent: requestUserAgent,
    });

    return buildErrorResponse(errorCode, message, status);
  }
}
