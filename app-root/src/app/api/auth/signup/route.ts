import "server-only";

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
import { getAllowedAppOrigins } from "@/lib/env/public-env";
import { ServerEnv } from "@/lib/env/server-env";
import { getTurnstileRequestContext } from "@/lib/auth/turnstile-diagnostics";
import {
  UNKNOWN_DEVICE_FINGERPRINT,
  isUnknownDeviceFingerprint,
} from "@/lib/auth/device-fingerprint";
import { assessSignupRisk } from "@/lib/auth/signup-risk";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import {
  isUpstashRedisConfigured,
  takeSlidingWindowRateLimit,
} from "@/lib/auth/upstash-rate-limit";
import { getRequestIp } from "@/lib/api/rate-limit";
import {
  isEmailRateLimitError,
  isUserAlreadyRegisteredError,
  isWeakPasswordError,
} from "@/lib/supabase/auth-errors";
import {
  EMAIL_ALREADY_EXISTS_ERROR,
  EMAIL_RATE_LIMITED_ERROR,
  INTERNAL_ERROR,
  INVALID_EMAIL_ERROR,
  INVALID_PASSWORD_ERROR,
  INVALID_REDIRECT_URL_ERROR,
  MISSING_FIELDS_ERROR,
  normalizeEmail,
  PASSWORD_MISMATCH_ERROR,
  RATE_LIMITED_ERROR,
  TERMS_NOT_ACCEPTED_ERROR,
  TURNSTILE_FAILED_ERROR,
  TURNSTILE_TOKEN_USED_ERROR,
  type SignupApiResponse,
  type SignupApiErrorCode as SignupErrorCode,
  type SignupRisk,
  type SignupApiTurnstileDiagnostics,
} from "@/lib/supabase/signup";
import {
  logTurnstileEnvDebug,
  readTurnstileServerEnv,
} from "@/lib/env/turnstile-server";
import {
  canUseLocalhostTurnstileTestKeys,
  TURNSTILE_DOMAIN_INACTIVE_MESSAGE,
} from "@/lib/env/turnstile";
import { Runtime } from "@/lib/env/runtime";
import {
  generateVerificationCode,
  hashVerificationCode,
  getCodeExpiryTimestamp,
} from "@/lib/auth/verification-code";

export const runtime = "nodejs";

const ROUTE_TAG = "[auth.signup]";

// PRODUCTION-SAFE: In-flight request deduplication
// Uses a Map to track requests currently being processed by idempotency key
// This prevents duplicate user creation from rapid double-clicks or network retries
const inProgressRequests = new Map<string, Promise<SignupResult>>();
const COMPLETED_REQUEST_TTL_MS = 30_000; // Keep completed results for 30s

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_FROM_EMAIL = "Assetly <onboarding@resend.dev>";
const PASSWORD_MIN_LENGTH = 8;
const SIGNUP_DUPLICATE_LOOKUP_MAX_PAGES = 20;
const SIGNUP_DUPLICATE_LOOKUP_PAGE_SIZE = 100;
const SIGNUP_IP_RATE_LIMIT_CAPACITY = 5;
const SIGNUP_EMAIL_RATE_LIMIT_CAPACITY = 3;
const SIGNUP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const isDevelopmentEnvironment = () => !Runtime.isBuild();

// Result types for atomic flow - WITH FULL ERROR VISIBILITY
type SignupResult =
  | { ok: true; userId: string; emailStatus: "sent" | "failed"; verified: true; warnings?: string[] }
  | { ok: false; step: "turnstile" | "user" | "profile" | "email"; error: string; message: string };

type SignupRequestBody = {
  acceptedTerms?: unknown;
  confirmPassword?: unknown;
  deviceFingerprint?: unknown;
  email?: unknown;
  emailRedirectTo?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  password?: unknown;
  requestId?: unknown;
  turnstileToken?: unknown;
};

type SignupEmailStatus = "failed" | "sent";

type SupabaseAuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  weak_password?: {
    message?: string | null;
    reasons?: string[] | null;
  } | null;
};

type SignupSuccessResponse = {
  ok: true;
  emailError: string | null;
  emailSent: boolean;
  userCreated: true;
  warning?: string | null;
  verified: true;
  emailStatus: "sent" | "failed";
  requestId: string;
  message?: string;
  risk?: SignupRisk;
  warnings?: string[];
};

type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

type SecurityEventParams = {
  email?: string | null;
  eventType: string;
  ip?: string | null;
  metadata?: JsonValue;
  userAgent?: string | null;
  userId?: string | null;
};

type FailureResponseInput = {
  step: "captcha" | "user" | "email";
  error: string;
  reason?: string;
  shouldResetTurnstile?: boolean;
  eventType: string;
  headers?: HeadersInit;
  message: string;
  metadata?: Record<string, unknown>;
  status: number;
  turnstile?: SignupApiTurnstileDiagnostics;
  turnstileErrorCodes?: string[];
  turnstileVerified?: boolean;
  triggeredEmailRateLimit?: boolean;
  triggeredIpRateLimit?: boolean;
  userId?: string | null;
  details?: { shouldResetTurnstile?: boolean };
};

const notificationPreferences = {
  document: true,
  documentExpiry: true,
  document_email: true,
  document_expiry: true,
  document_expiry_email: true,
  email: true,
  frequency: "Anında",
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

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

type EnvLookupKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "RESEND_API_KEY"
  | "AUTOMATION_FROM_EMAIL"
  | "AUTOMATION_REPLY_TO_EMAIL";

const readServerEnvValue = (key: EnvLookupKey) => {
  switch (key) {
    case "NEXT_PUBLIC_SUPABASE_URL":
      return ServerEnv.NEXT_PUBLIC_SUPABASE_URL;
    case "SUPABASE_SERVICE_ROLE_KEY":
      return ServerEnv.SUPABASE_SERVICE_ROLE_KEY;
    case "RESEND_API_KEY":
      return ServerEnv.RESEND_API_KEY;
    case "AUTOMATION_FROM_EMAIL":
      return ServerEnv.AUTOMATION_FROM_EMAIL;
    case "AUTOMATION_REPLY_TO_EMAIL":
      return ServerEnv.AUTOMATION_REPLY_TO_EMAIL;
    default:
      return null;
  }
};

const getOptionalEnv = (key: string) => {
  const value = readServerEnvValue(key as EnvLookupKey);
  return value && value.trim().length > 0 ? value : null;
};

const getRequiredEnv = (key: string) => {
  const value = getOptionalEnv(key);

  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "unknown_error",
    name: "UnknownError",
    stack: null,
  };
};

const serializeSupabaseAuthError = (error?: SupabaseAuthErrorLike | null) => ({
  authErrorCode: error?.code ?? null,
  authErrorMessage: error?.message ?? null,
  authErrorStatus: error?.status ?? null,
  weakPasswordMessage: error?.weak_password?.message ?? null,
  weakPasswordReasons: Array.isArray(error?.weak_password?.reasons)
    ? error?.weak_password?.reasons.filter(Boolean)
    : [],
});

const logSupabaseResponse = (message: string, details?: Record<string, unknown>) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.info(`${ROUTE_TAG} ${message}`, details ?? {});
};

const logSignupStep = (step: "TURNSTILE PASSED" | "USER CREATED" | "EMAIL TRIGGERED", details?: Record<string, unknown>) => {
  console.info(`${ROUTE_TAG} ${step}`, details ?? {});
};

const logReturnReason = (reason: string, details?: Record<string, unknown>) => {
  console.warn(`${ROUTE_TAG} RETURN`, {
    details: details ?? null,
    reason,
  });
};

const toJsonValue = (value: unknown): JsonValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, toJsonValue(nestedValue)]),
    );
  }

  return String(value);
};

const maskTokenForLogs = (token: string) => {
  const trimmedToken = token.trim();

  if (!trimmedToken) {
    return null;
  }

  if (trimmedToken.length <= 12) {
    return `${trimmedToken.slice(0, 4)}...`;
  }

  return `${trimmedToken.slice(0, 8)}...${trimmedToken.slice(-6)}`;
};

const maskUrlForLogs = (value?: string | null) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);
    return `${url.origin}${url.pathname}`;
  } catch {
    return maskTokenForLogs(trimmedValue);
  }
};

const logTurnstileDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.info(`${ROUTE_TAG} ${message}`, details ?? {});
};

const getTurnstileFailureCategory = (input: {
  errorCodes?: string[];
  hostnameMismatch?: boolean;
  issue?: SignupApiTurnstileDiagnostics["issue"] | null;
}) => {
  if (input.hostnameMismatch) {
    return "mismatch";
  }

  if (input.issue === "env") {
    return "env";
  }

  if (input.issue === "key") {
    return "key";
  }

  if (input.issue === "domain" || input.errorCodes?.includes("110200")) {
    return "domain";
  }

  if (input.issue === "token" || input.errorCodes?.includes("invalid-input-response")) {
    return "token";
  }

  if (input.issue === "unknown") {
    return "mismatch";
  }

  return "mismatch";
};

const buildFallbackRisk = (reason: string): SignupRisk => ({
  level: "low",
  reasons: [reason],
  score: 0,
  signals: {
    deviceAttemptsLast10m: 0,
    emailAttemptsLast10m: 0,
    emailDistinctDeviceCount: 0,
    emailDistinctIpCount: 0,
    hasDeviceFingerprint: false,
    ipAttemptsLast10m: 0,
    ipDistinctEmailCount: 0,
    isNewDevice: false,
    isNewIp: false,
    previousEmailRiskScore: 0,
    previousIpRiskScore: 0,
    turnstileErrorCodes: [],
  },
});

const buildRiskMetadata = (risk: SignupRisk, deviceFingerprint?: string | null) => ({
  device_fingerprint: deviceFingerprint?.trim() || UNKNOWN_DEVICE_FINGERPRINT,
  risk_level: risk.level,
  risk_reasons: risk.reasons,
  risk_score: risk.score,
  risk_signals: risk.signals,
});

const buildResponse = (
  input: Omit<SignupApiResponse, "requestId">,
  reqId: string,
  responseStatus: number = 200,
  headers?: HeadersInit,
) =>
  NextResponse.json<SignupApiResponse>(
    {
      ok: input.ok,
      step: input.step,
      status: input.status,
      error: input.error,
      reason: input.reason,
      message: input.message,
      requestId: reqId,
      shouldResetTurnstile: input.shouldResetTurnstile,
      risk: input.risk,
      turnstile: input.turnstile,
      verified: input.verified,
      emailStatus: input.emailStatus,
    },
    { status: responseStatus, headers },
  );

const buildErrorResponse = (
  error: string,
  message: string,
  status: number,
  risk: SignupRisk,
  headers?: HeadersInit,
  turnstile?: SignupApiTurnstileDiagnostics,
  details?: { shouldResetTurnstile?: boolean },
) => {
  const reqId = crypto.randomUUID();
  return buildResponse(
    {
      ok: false,
      step: turnstile ? "captcha" : "user",
      status: "failed",
      error,
      message,
      shouldResetTurnstile: details?.shouldResetTurnstile,
      turnstile,
      risk,
    },
    reqId,
    status,
    headers,
  );
};

const getAllowedRedirectOrigins = (request: Request) => {
  const origins = new Set<string>(getAllowedAppOrigins());

  if (request.url?.trim()) {
    try {
      origins.add(new URL(request.url).origin);
    } catch {
      // Ignore malformed request URL; configured origins still apply.
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

const createAdminClient = () => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const safeLogSecurityEvent = async (
  adminClient: ReturnType<typeof createAdminClient> | null,
  params: SecurityEventParams,
) => {
  if (!adminClient) {
    return;
  }

  try {
    const { error } = await adminClient.from("auth_security_logs").insert({
      email: params.email?.trim() || null,
      event_type: params.eventType,
      ip: params.ip?.trim() || null,
      metadata: toJsonValue(params.metadata ?? {}),
      user_agent: params.userAgent?.trim() || null,
      user_id: params.userId ?? null,
    });

    if (error) {
      console.error(`${ROUTE_TAG} Failed to persist auth security log.`, {
        error,
        eventType: params.eventType,
      });
    }
  } catch (error) {
    console.error(`${ROUTE_TAG} Failed to persist auth security log.`, serializeError(error));
  }
};


const buildSignupEmailHtml = (input: {
  code: string;
  firstName: string;
}) => `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8fafc;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 32px 24px;background:#0f172a;text-align:center;">
          <img src="https://www.assetly.network/icons/icon-192-v2.png" alt="Assetly" style="height:56px;width:56px;display:block;margin:0 auto 12px;border-radius:12px;" />
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Assetly</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Do\u011frulama Kodunuz</h2>
          <p style="margin:0 0 12px;color:#334155;line-height:1.6;">Merhaba ${input.firstName},</p>
          <p style="margin:0 0 24px;color:#334155;line-height:1.6;">Hesab\u0131n\u0131z\u0131 do\u011frulamak i\u00e7in a\u015fa\u011f\u0131daki kodu kullan\u0131n:</p>
          <table role="presentation" style="width:100%;margin:24px 0;">
            <tr><td style="text-align:center;background:#f1f5f9;border-radius:12px;padding:24px;">
              <code style="font-size:36px;font-weight:700;color:#0f172a;letter-spacing:8px;">${input.code}</code>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.5;">Bu kod 10 dakika i\u00e7inde ge\u00e7erlili\u011fini yitirecektir.</p>
          <p style="margin:8px 0 0;color:#64748b;font-size:14px;line-height:1.5;">E\u011fer bu i\u015flemi siz ba\u015flatmad\u0131ysan\u0131z, bu e-postay\u0131 dikkate almayabilirsiniz.</p>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f1f5f9;text-align:center;">
          <p style="margin:0;color:#64748b;font-size:12px;">Assetly - Varl\u0131k Y\u00f6netim Sistemi</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const buildSignupEmailText = (input: {
  code: string;
  firstName: string;
}) =>
  [
    `Merhaba ${input.firstName},`,
    "",
    "Hesab\u0131n\u0131z\u0131 do\u011frulamak i\u00e7in a\u015fa\u011f\u0131daki kodu kullan\u0131n:",
    "",
    `Do\u011frulama kodunuz: ${input.code}`,
    "",
    "Bu kod 10 dakika i\u00e7inde ge\u00e7erlili\u011fini yitirecektir.",
    "E\u011fer bu i\u015flemi siz ba\u015flatmad\u0131ysan\u0131z, bu e-postay\u0131 dikkate almayabilirsiniz.",
    "",
    "Assetly - Varl\u0131k Y\u00f6netim Sistemi",
  ].join("\n");

// VISIBLE EMAIL SENDING: With timeout and clear logging
const sendSignupConfirmationEmailAsync = async (input: {
  code: string;
  email: string;
  firstName: string;
  userId: string;
}): Promise<{ status: "sent" | "failed"; message: string }> => {
  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("AUTOMATION_FROM_EMAIL") ?? DEFAULT_FROM_EMAIL;
  const replyTo = getOptionalEnv("AUTOMATION_REPLY_TO_EMAIL");

  console.log("EMAIL_ATTEMPT", {
    email: input.email,
    userId: input.userId,
    hasApiKey: Boolean(resendApiKey),
    fromEmail,
  });

  if (!resendApiKey) {
    const failMsg = "RESEND_API_KEY env değişkeni eksik";
    console.log("EMAIL_FAILED", { email: input.email, userId: input.userId, error: failMsg, reason: "missing_api_key" });
    return { status: "failed", message: failMsg };
  }

  // Validate FROM email
  if (!fromEmail || fromEmail.includes("resend.dev") || fromEmail.includes("example.com")) {
    const failMsg = `Geçersiz gönderen e-posta adresi: ${fromEmail}. Lütfen AUTOMATION_FROM_EMAIL env değişkenini ayarlayın.`;
    console.log("EMAIL_FAILED", { email: input.email, userId: input.userId, error: failMsg, reason: "invalid_from_email" });
    return { status: "failed", message: failMsg };
  }

  const sendEmailPromise = async () => {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        from: fromEmail,
        html: buildSignupEmailHtml({ code: input.code, firstName: input.firstName }),
        reply_to: replyTo ? [replyTo] : undefined,
        subject: "Do\u011frulama kodunuz - Assetly",
        text: buildSignupEmailText({ code: input.code, firstName: input.firstName }),
        to: [input.email],
      }),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      return { status: "failed" as const, message: `Resend API hatası: ${response.status} - ${responseText}` };
    }

    return { status: "sent" as const, message: "Email sent successfully" };
  };

  try {
    const result = await Promise.race([
      sendEmailPromise(),
      new Promise<{ status: "failed"; message: string }>((resolve) =>
        setTimeout(() => resolve({ status: "failed", message: "Email sending timeout (10s)" }), 10_000)
      ),
    ]);

    // Log with exact names required by spec
    if (result.status === "sent") {
      console.log("EMAIL_SUCCESS", {
        email: input.email,
        userId: input.userId,
        message: result.message,
      });
    } else {
      console.log("EMAIL_FAILED", {
        email: input.email,
        userId: input.userId,
        error: result.message,
        reason: "resend_api_error",
      });
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.log("EMAIL_FAILED", {
      email: input.email,
      userId: input.userId,
      error: errorMsg,
      reason: "exception",
    });
    return { status: "failed", message: errorMsg };
  }
};

// Backwards compat - deprecated, use sendSignupConfirmationEmailAsync
const sendSignupConfirmationEmail = async (input: {
  code: string;
  email: string;
  firstName: string;
}) => {
  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("AUTOMATION_FROM_EMAIL") ?? DEFAULT_FROM_EMAIL;
  const replyTo = getOptionalEnv("AUTOMATION_REPLY_TO_EMAIL");

  logSignupStep("EMAIL TRIGGERED", {
    email: input.email,
    fromEmail,
    resendConfigured: Boolean(resendApiKey),
    replyTo: replyTo ?? null,
  });

  if (!resendApiKey) {
    throw new Error("Missing required env var: RESEND_API_KEY");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      from: fromEmail,
      html: buildSignupEmailHtml({ code: input.code, firstName: input.firstName }),
      reply_to: replyTo ? [replyTo] : undefined,
      subject: "Do\u011frulama kodunuz - Assetly",
      text: buildSignupEmailText({ code: input.code, firstName: input.firstName }),
      to: [input.email],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const responseText = await response.text();
  let parsedResponse: unknown = null;

  try {
    parsedResponse = responseText ? JSON.parse(responseText) : null;
  } catch {
    parsedResponse = responseText;
  }

  console.info(`${ROUTE_TAG} Resend email API response.`, {
    email: input.email,
    ok: response.ok,
    parsedResponse,
    status: response.status,
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with status ${response.status}: ${responseText}`);
  }

  return parsedResponse;
};

const updateUserEmailStatus = async (input: {
  adminClient: ReturnType<typeof createAdminClient>;
  emailFailureReason?: string | null;
  emailStatus: SignupEmailStatus;
  user: User;
}) => {
  const nextUserMetadata = {
    ...(input.user.user_metadata ?? {}),
    email_failure_reason: input.emailFailureReason ?? null,
    email_sent_at: input.emailStatus === "sent" ? new Date().toISOString() : null,
    email_status: input.emailStatus,
  };

  const { error } = await input.adminClient.auth.admin.updateUserById(input.user.id, {
    user_metadata: nextUserMetadata,
  });

  console.info(`${ROUTE_TAG} Email status update result.`, {
    emailFailureReason: input.emailFailureReason ?? null,
    emailStatus: input.emailStatus,
    error,
    userId: input.user.id,
  });

  if (error) {
    throw new Error(`Failed to update email status metadata: ${error.message}`);
  }
};

const evaluateRiskSafely = async (input: {
  deviceFingerprint?: string | null;
  email: string;
  emailRateLimited?: boolean;
  ip: string;
  ipRateLimited?: boolean;
  outcome: string;
  turnstileErrorCodes?: string[];
  turnstileTokenPresent: boolean;
  turnstileVerified: boolean;
  userAgent?: string | null;
}) => {
  if (!isUpstashRedisConfigured()) {
    console.warn(`${ROUTE_TAG} Risk evaluation skipped because Upstash Redis is not configured.`);
    return buildFallbackRisk("risk_checks_skipped");
  }

  try {
    return await assessSignupRisk({
      deviceFingerprint: input.deviceFingerprint,
      email: input.email,
      ip: input.ip,
      outcome: input.outcome,
      rateLimit: {
        emailTriggered: input.emailRateLimited ?? false,
        ipTriggered: input.ipRateLimited ?? false,
      },
      turnstile: {
        errorCodes: input.turnstileErrorCodes ?? [],
        tokenPresent: input.turnstileTokenPresent,
        verified: input.turnstileVerified,
      },
      userAgent: input.userAgent,
    });
  } catch (error) {
    console.error(`${ROUTE_TAG} Risk evaluation failed. Continuing with fallback risk.`, serializeError(error));
    return buildFallbackRisk("risk_checks_failed");
  }
};

const takeRateLimitSafely = async (input: {
  limit: number;
  requestIp: string;
  scope: string;
  subject: string;
  windowMs: number;
}) => {
  if (!isUpstashRedisConfigured()) {
    console.warn(`${ROUTE_TAG} Upstash Redis is not configured. Rate limit check skipped.`, {
      requestIp: input.requestIp,
      scope: input.scope,
      subject: input.scope === "auth_signup_email" ? "email_redacted" : input.subject,
    });

    return {
      allowed: true,
      bypassed: true,
      remaining: null,
      retryAfterMs: 0,
    };
  }

  try {
    const result = await takeSlidingWindowRateLimit({
      limit: input.limit,
      scope: input.scope,
      subject: input.subject,
      windowMs: input.windowMs,
    });

    return {
      ...result,
      bypassed: false,
    };
  } catch (error) {
    console.error(`${ROUTE_TAG} Rate limit check failed. Continuing without blocking signup.`, {
      error: serializeError(error),
      requestIp: input.requestIp,
      scope: input.scope,
      subject: input.scope === "auth_signup_email" ? "email_redacted" : input.subject,
    });

    return {
      allowed: true,
      bypassed: true,
      remaining: null,
      retryAfterMs: 0,
    };
  }
};

const findExistingAuthUserByEmail = async ({
  adminClient,
  email,
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  email: string;
}) => {
  console.info(`${ROUTE_TAG} Checking for duplicate email before signup.`, {
    email,
  });

  for (let page = 1; page <= SIGNUP_DUPLICATE_LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: SIGNUP_DUPLICATE_LOOKUP_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Failed to list auth users for duplicate check: ${error.message}`);
    }

    const foundUser =
      data.users.find((user) => (user.email ?? "").trim().toLowerCase() === email) ?? null;

    if (foundUser) {
      console.info(`${ROUTE_TAG} Duplicate email detected before signup.`, {
        email,
        userId: foundUser.id,
      });
      return foundUser;
    }

    if (data.users.length < SIGNUP_DUPLICATE_LOOKUP_PAGE_SIZE) {
      break;
    }
  }

  console.info(`${ROUTE_TAG} Duplicate email check completed with no existing auth user.`, {
    email,
  });

  return null;
};

const normalizeDeviceFingerprint = (value: unknown) => {
  if (!isNonEmptyString(value)) {
    return UNKNOWN_DEVICE_FINGERPRINT;
  }

  const normalized = value.trim();
  return normalized || UNKNOWN_DEVICE_FINGERPRINT;
};

// PRODUCTION-SAFE: Idempotency helpers for preventing duplicate requests
const generateIdempotencyKey = (email: string, turnstileToken: string): string => {
  // Hash email + token prefix for idempotency key
  const normalizedEmail = email.toLowerCase().trim();
  const tokenPrefix = turnstileToken.slice(0, 16); // First 16 chars of token
  return `${normalizedEmail}:${tokenPrefix}`;
};

const cleanupInProgressRequest = (key: string, delayMs = COMPLETED_REQUEST_TTL_MS) => {
  setTimeout(() => {
    inProgressRequests.delete(key);
  }, delayMs);
};

const getTurnstileFailureMessage = (
  reason: "invalid" | "missing_secret" | "network_error",
  turnstileEnv?: ReturnType<typeof readTurnstileServerEnv>,
  errorCodes?: string[],
  diagnostics?: SignupApiTurnstileDiagnostics,
) => {
  if (reason === "missing_secret") {
    const missingVars = turnstileEnv?.missing?.length
      ? ` Eksik de\u011fi\u015fkenler: ${turnstileEnv.missing.join(", ")}.`
      : "";
    const envPath = turnstileEnv?.rootEnvLocalPath
      ? ` De\u011ferleri ${turnstileEnv.rootEnvLocalPath} dosyas\u0131na ekleyip sunucuyu yeniden ba\u015flat\u0131n.`
      : "";

    return `Turnstile sunucu do\u011frulamas\u0131 yap\u0131land\u0131r\u0131lmam\u0131\u015f.${missingVars}${envPath}`.trim();
  }

  if (reason === "network_error") {
    return "Turnstile do\u011frulamas\u0131 tamamlanamad\u0131. L\u00fctfen tekrar deneyin.";
  }

  if (diagnostics?.hostnameMismatch || errorCodes?.includes("110200")) {
    return TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
  }

  if (errorCodes?.includes("invalid-input-secret")) {
    return "Turnstile secret key ge\u00e7ersiz. Cloudflare secret ayar\u0131n\u0131 kontrol edin.";
  }

  if (errorCodes?.includes("invalid-input-response")) {
    return "Turnstile token ge\u00e7ersiz veya beklenenden farkl\u0131. L\u00fctfen do\u011frulamay\u0131 yeniden tamamlay\u0131n.";
  }

  return "Turnstile do\u011frulamas\u0131 ba\u015far\u0131s\u0131z oldu.";
};

// PRODUCTION-SAFE: Atomic signup handler with idempotency and rollback guarantee
export async function POST(request: Request) {
  const requestIp = getRequestIp(request);
  const requestUserAgent = request.headers.get("user-agent")?.trim() || null;
  const {
    headers: { host: hostHeader, origin, xForwardedHost: forwardedHost },
    requestHostname: requestHost,
  } = getTurnstileRequestContext(request);

  const adminClient = (() => {
    try {
      return createAdminClient();
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to initialize Supabase admin client.`, serializeError(error));
      return null;
    }
  })();

  // Parse request body early for idempotency key generation
  let body: SignupRequestBody;
  try {
    body = (await request.json()) as SignupRequestBody;
  } catch (error) {
    console.error("SIGNUP_ERROR", { step: "parse_body", error: serializeError(error) });
    return NextResponse.json(
      { ok: false, step: "user", error: MISSING_FIELDS_ERROR },
      { status: 400 }
    );
  }

  // Extract and validate required fields
  const acceptedTerms = body.acceptedTerms === true;
  const firstName = isNonEmptyString(body.firstName) ? body.firstName.trim() : "";
  const lastName = isNonEmptyString(body.lastName) ? body.lastName.trim() : "";
  const email = isNonEmptyString(body.email) ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  const emailRedirectTo = isNonEmptyString(body.emailRedirectTo) ? body.emailRedirectTo.trim() : "";
  const turnstileToken = isNonEmptyString(body.turnstileToken) ? body.turnstileToken.trim() : "";
  const deviceFingerprint = normalizeDeviceFingerprint(body.deviceFingerprint);
  const normalizedEmail = email ? normalizeEmail(email) : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  // Basic validation (fast-fail before idempotency check)
  if (!firstName || !lastName || !normalizedEmail || !password || !confirmPassword || !emailRedirectTo) {
    return NextResponse.json(
      { ok: false, step: "user", error: MISSING_FIELDS_ERROR },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { ok: false, step: "user", error: PASSWORD_MISMATCH_ERROR },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return NextResponse.json(
      { ok: false, step: "user", error: INVALID_EMAIL_ERROR },
      { status: 400 }
    );
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { ok: false, step: "user", error: INVALID_PASSWORD_ERROR },
      { status: 400 }
    );
  }

  if (!acceptedTerms) {
    return NextResponse.json(
      { ok: false, step: "user", error: TERMS_NOT_ACCEPTED_ERROR },
      { status: 400 }
    );
  }

  if (!turnstileToken) {
    return NextResponse.json(
      { ok: false, step: "turnstile", error: TURNSTILE_FAILED_ERROR },
      { status: 400 }
    );
  }

  // IDEMPOTENCY: Check for duplicate in-flight requests
  const idempotencyKey = generateIdempotencyKey(normalizedEmail, turnstileToken);
  const existingRequest = inProgressRequests.get(idempotencyKey);
  if (existingRequest) {
    console.log("IDEMPOTENCY_HIT", { email: normalizedEmail, key: idempotencyKey });
    const result = await existingRequest;
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  // Create the signup promise and store it
  const signupPromise = executeAtomicSignup({
    adminClient,
    acceptedTerms,
    deviceFingerprint,
    email: normalizedEmail,
    emailRedirectTo,
    firstName,
    fullName,
    lastName,
    password,
    requestHost,
    requestIp,
    requestUserAgent,
    turnstileToken,
  });

  inProgressRequests.set(idempotencyKey, signupPromise);

  // Cleanup after completion (success or failure)
  signupPromise
    .then(() => cleanupInProgressRequest(idempotencyKey))
    .catch(() => cleanupInProgressRequest(idempotencyKey));

  const result = await signupPromise;
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

// ATOMIC SIGNUP EXECUTION - All or nothing
async function executeAtomicSignup(input: {
  adminClient: ReturnType<typeof createAdminClient> | null;
  acceptedTerms: boolean;
  deviceFingerprint: string;
  email: string;
  emailRedirectTo: string;
  firstName: string;
  fullName: string;
  lastName: string;
  password: string;
  requestHost: string | null;
  requestIp: string;
  requestUserAgent: string | null;
  turnstileToken: string;
}): Promise<SignupResult> {
  const ROUTE_TAG = "[auth.signup]";

  // STEP 1: Verify Turnstile
  const turnstileVerification = await verifyTurnstileToken({
    requestHost: input.requestHost,
    remoteIp: input.requestIp,
    token: input.turnstileToken,
  });

  console.log("TURNSTILE_RESULT", {
    ok: turnstileVerification.ok,
    success: turnstileVerification.ok,
    hostnameMismatch: turnstileVerification.hostnameMismatch,
    errorCodes: turnstileVerification.errorCodes,
    issue: turnstileVerification.issue,
  });

  if (!turnstileVerification.ok || turnstileVerification.hostnameMismatch) {
    const turnstileMessage = turnstileVerification.hostnameMismatch
      ? `Turnstile hostname mismatch: expected ${turnstileVerification.requestHostname}, got ${turnstileVerification.hostname}`
      : `Turnstile verification failed: ${turnstileVerification.errorCodes.join(", ") || "unknown error"}`;
    console.log("TURNSTILE_FAILED", { errorCodes: turnstileVerification.errorCodes, hostnameMismatch: turnstileVerification.hostnameMismatch });
    return {
      ok: false,
      step: "turnstile",
      error: TURNSTILE_FAILED_ERROR,
      message: turnstileMessage,
    };
  }

  // STEP 2: Rate limiting
  const ipRateLimit = await takeRateLimitSafely({
    limit: SIGNUP_IP_RATE_LIMIT_CAPACITY,
    requestIp: input.requestIp,
    scope: "auth_signup_ip",
    subject: input.requestIp,
    windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
  });

  if (!ipRateLimit.allowed && !ipRateLimit.bypassed) {
    return { ok: false, step: "user", error: RATE_LIMITED_ERROR, message: "Çok fazla kayıt denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin." };
  }

  const emailRateLimit = await takeRateLimitSafely({
    limit: SIGNUP_EMAIL_RATE_LIMIT_CAPACITY,
    requestIp: input.requestIp,
    scope: "auth_signup_email",
    subject: input.email,
    windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
  });

  if (!emailRateLimit.allowed && !emailRateLimit.bypassed) {
    return { ok: false, step: "user", error: EMAIL_RATE_LIMITED_ERROR, message: "Bu e-posta adresi için çok fazla deneme yapıldı. Lütfen 1 dakika bekleyin." };
  }

  // STEP 3: Create Supabase Auth User
  if (!input.adminClient) {
    console.log("ADMIN_CLIENT_MISSING", { reason: "Supabase admin client initialization failed - check SUPABASE_SERVICE_ROLE_KEY" });
    return { ok: false, step: "user", error: INTERNAL_ERROR, message: "Supabase admin client oluşturulamadı. SERVICE_ROLE_KEY env değişkenini kontrol edin." };
  }

  const initialUserMetadata = {
    email_status: "pending",
    first_name: input.firstName,
    full_name: input.fullName,
    last_name: input.lastName,
    // UNIFIED SCHEMA: Single accepted_terms field covers all legal consents
    legal_consents: {
      accepted_terms: input.acceptedTerms,
      consented_at: new Date().toISOString(),
    },
    notification_preferences: notificationPreferences,
  };

  let theUserId: string | null = null;

  try {
    const { data: signupData, error: signupError } = await input.adminClient.auth.admin.generateLink({
      email: input.email,
      options: {
        data: initialUserMetadata,
        redirectTo: input.emailRedirectTo,
      },
      password: input.password,
      type: "signup",
    });

    if (signupError) {
      if (isUserAlreadyRegisteredError(signupError)) {
        // Duplicate email - return clear error with login suggestion
        console.log("DUPLICATE_EMAIL", { email: input.email });
        return {
          ok: false,
          step: "user",
          error: EMAIL_ALREADY_EXISTS_ERROR,
          message: "Bu e-posta ile kay\u0131tl\u0131 bir hesab\u0131n\u0131z var. Giri\u015f yapabilirsiniz.",
        };
      } else if (isWeakPasswordError(signupError)) {
        return { ok: false, step: "user", error: INVALID_PASSWORD_ERROR, message: "\u015eifre \u00e7ok zay\u0131f. En az 8 karakter, b\u00fcy\u00fck/k\u00fc\u00e7\u00fck harf ve rakam i\u00e7ermeli." };
      } else if (isEmailRateLimitError(signupError)) {
        return { ok: false, step: "user", error: EMAIL_RATE_LIMITED_ERROR, message: "Bu e-posta adresi i\u00e7in \u00e7ok fazla deneme yap\u0131ld\u0131. L\u00fctfen 1 dakika bekleyin." };
      } else {
        console.log("USER_CREATE_RESULT", {
          ok: false,
          email: input.email,
          error: signupError.message,
          code: (signupError as { code?: string }).code,
        });
        return { ok: false, step: "user", error: INTERNAL_ERROR, message: `Kullan\u0131c\u0131 olu\u015fturma hatas\u0131: ${signupError.message}` };
      }
    } else {
      theUserId = signupData?.user?.id ?? null;
      console.log("USER_CREATED", {
        email: input.email,
        userId: theUserId,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.log("USER_CREATE_RESULT", {
      ok: false,
      email: input.email,
      error: errorMsg,
    });
    return { ok: false, step: "user", error: INTERNAL_ERROR, message: `Kullan\u0131c\u0131 olu\u015fturma hatas\u0131: ${errorMsg}` };
  }

  if (!theUserId) {
    console.log("USER_CREATE_RESULT", { ok: false, email: input.email, error: "No user ID returned from Supabase" });
    return { ok: false, step: "user", error: INTERNAL_ERROR, message: "Kullan\u0131c\u0131 olu\u015fturuldu ancak ID al\u0131namad\u0131. L\u00fctfen tekrar deneyin." };
  }

  // NOTE: DB records (profiles, user_consents, notification_settings) are created
  // in /api/auth/verify-code AFTER code is verified. This ensures atomic auth flow:
  // - Signup creates auth user only
  // - Database records created on first confirmed verification

  // STEP 4: Generate 6-digit verification code and store hash in user_metadata
  const verificationCode = generateVerificationCode();
  const codeHash = await hashVerificationCode(verificationCode);
  const codeExpiresAt = getCodeExpiryTimestamp();

  await input.adminClient.auth.admin.updateUserById(theUserId, {
    user_metadata: {
      ...initialUserMetadata,
      verification: {
        code_hash: codeHash,
        expires_at: codeExpiresAt,
        attempts: 0,
      },
    },
  }).catch((err) => {
    console.error(`${ROUTE_TAG} Failed to store verification code hash.`, err);
  });

  // STEP 5: Send verification code email (10s max timeout)
  // Email failure must NOT block signup - user is already created
  let emailStatus: "sent" | "failed" = "failed";
  let emailError: string | null = null;

  const emailResult = await sendSignupConfirmationEmailAsync({
    code: verificationCode,
    email: input.email,
    firstName: input.firstName,
    userId: theUserId,
  });

  emailStatus = emailResult.status;
  if (emailResult.status === "failed") {
    emailError = emailResult.message;
  }

  // Update user metadata with email status (best effort)
  input.adminClient?.auth.admin.updateUserById(theUserId, {
    user_metadata: {
      email_status: emailResult.status,
      email_failure_reason: emailResult.status === "failed" ? emailResult.message : null,
      email_sent_at: emailResult.status === "sent" ? new Date().toISOString() : null,
    },
  }).catch(() => {
    // Metadata update failure is not critical
  });

  // Log security event (async, don't block)
  evaluateRiskSafely({
    deviceFingerprint: input.deviceFingerprint,
    email: input.email,
    ip: input.requestIp,
    outcome: "signup_success",
    turnstileTokenPresent: true,
    turnstileVerified: true,
    userAgent: input.requestUserAgent,
  }).then((risk) => {
    safeLogSecurityEvent(input.adminClient, {
      email: input.email,
      eventType: "signup_success",
      ip: input.requestIp,
      metadata: {
        supabase_user_id: theUserId,
        email_status: emailStatus,
        email_error: emailError,
        ...buildRiskMetadata(risk, input.deviceFingerprint),
      },
      userAgent: input.requestUserAgent,
      userId: theUserId,
    });
  });

  // Return success - user is created regardless of email delivery
  console.log("SIGNUP_COMPLETE", {
    userId: theUserId,
    email: input.email,
    emailStatus,
    emailFailed: emailStatus === "failed",
  });

  const warnings: string[] = [];
  if (emailStatus === "failed" && emailError) {
    warnings.push(`Email gönderilemedi: ${emailError}`);
  }

  return {
    ok: true,
    userId: theUserId,
    emailStatus,
    verified: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
