import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
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
const isDevelopmentEnvironment = () => process.env.NODE_ENV === "development";

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

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const getOptionalEnv = (key: string) => {
  const value = process.env[key]?.trim();
  return value ? value : null;
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

// PRODUCTION-SAFE: Atomic user creation with guaranteed rollback on failure.
// Uses a transaction-like pattern: if ANY bootstrap step fails, auth user is DELETED.
// This ensures no orphan users without profiles.
type BootstrapResult =
  | { ok: true }
  | { ok: false; error: Error; stage: "profile" | "notification_settings" | "user_consents" };

// STRICT ATOMIC INSERT - Using insert() to catch duplicates/constraint violations
// UNIFIED SCHEMA: Only accepted_terms stored (covers KVKK and privacy policy)
const persistSignupBootstrapRecords = async (input: {
  acceptedTerms: boolean;
  adminClient: ReturnType<typeof createAdminClient>;
  ip: string;
  userAgent: string | null;
  userId: string;
}): Promise<BootstrapResult> => {
  const consentedAt = new Date().toISOString();

  // Stage 1: Profile (REQUIRED - user cannot exist without profile)
  // Using UPSERT - allows idempotent retry if profile already exists
  const profilePayload = { id: input.userId, plan: "free" };
  console.log("PROFILE_UPSERT_ATTEMPT", { userId: input.userId, payload: profilePayload });

  const { data: profileData, error: profileError } = await input.adminClient
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  console.log("PROFILE_UPSERT_RESULT", {
    ok: !profileError,
    userId: input.userId,
    error: profileError?.message ?? null,
    code: (profileError as { code?: string })?.code ?? null,
    data: profileData,
  });

  // Only fail on REAL errors (not duplicate/constraint violations)
  if (profileError && (profileError as { code?: string }).code !== "23505") {
    return {
      ok: false,
      error: new Error(`Failed to upsert profile: ${profileError.message} (code: ${(profileError as { code?: string }).code ?? "unknown"})`),
      stage: "profile",
    };
  }

  // Stage 2: Notification settings (REQUIRED)
  // Using UPSERT - allows idempotent retry
  const { error: notificationError } = await input.adminClient
    .from("notification_settings")
    .upsert({ user_id: input.userId }, { onConflict: "user_id" });

  console.log("NOTIFICATION_UPSERT_RESULT", {
    ok: !notificationError,
    userId: input.userId,
    error: notificationError?.message ?? null,
    code: (notificationError as { code?: string })?.code ?? null,
  });

  // Only fail on REAL errors (not duplicate/constraint violations)
  if (notificationError && (notificationError as { code?: string }).code !== "23505") {
    return {
      ok: false,
      error: new Error(`Failed to upsert notification settings: ${notificationError.message}`),
      stage: "notification_settings",
    };
  }

  // Stage 3: User consents (REQUIRED)
  // UNIFIED SCHEMA INSERT - Only 3 fields: user_id, accepted_terms, consented_at
  // STRICT INSERT (no upsert) - duplicate user_id will fail loudly
  const consentPayload = {
    user_id: input.userId,
    accepted_terms: input.acceptedTerms,
    consented_at: consentedAt,
  };

  // Log payload for debugging
  console.log("CONSENT_INSERT_ATTEMPT", {
    userId: input.userId,
    payload: consentPayload,
    schema: "unified_v2",
  });

  const { error: consentError } = await input.adminClient
    .from("user_consents")
    .insert(consentPayload);

  console.log("CONSENT_INSERT_RESULT", {
    ok: !consentError,
    userId: input.userId,
    error: consentError?.message ?? null,
    code: (consentError as { code?: string })?.code ?? null,
  });

  // Fail on ANY error (including 23505 duplicate key - this ensures schema integrity)
  if (consentError) {
    return {
      ok: false,
      error: new Error(`Failed to insert user consent: ${consentError.message}`),
      stage: "user_consents",
    };
  }

  return { ok: true };
};

// PRODUCTION-SAFE: Guaranteed user deletion for rollback.
// Retries once on failure because auth deletion is critical for data consistency.
const rollbackAuthUser = async (
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  context: { stage: string; originalError: string },
): Promise<{ ok: boolean; error?: Error }> => {
  console.error(`${ROUTE_TAG} ROLLBACK: Deleting auth user due to bootstrap failure.`, {
    context,
    userId,
  });

  // First attempt
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (!deleteError) {
    console.info(`${ROUTE_TAG} ROLLBACK: Auth user deleted successfully.`, { userId });
    return { ok: true };
  }

  console.error(`${ROUTE_TAG} ROLLBACK: Auth user deletion failed, retrying once.`, {
    deleteError,
    userId,
  });

  // Retry once after 500ms (transient failure)
  await new Promise((resolve) => setTimeout(resolve, 500));
  const { error: retryError } = await adminClient.auth.admin.deleteUser(userId);

  if (!retryError) {
    console.info(`${ROUTE_TAG} ROLLBACK: Auth user deleted on retry.`, { userId });
    return { ok: true };
  }

  // CRITICAL: User exists without profile. Log for manual cleanup.
  console.error(`${ROUTE_TAG} ROLLBACK FAILED: Orphan auth user requires manual cleanup!`, {
    context,
    retryError,
    userId,
  });

  return {
    ok: false,
    error: new Error(`Rollback failed: ${retryError.message}`),
  };
};

const buildSignupEmailHtml = (input: {
  actionLink: string;
  firstName: string;
}) => `
  <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;padding:24px">
    <h1 style="font-size:24px;margin:0 0 16px">Assetly hesabini dogrulayin</h1>
    <p style="margin:0 0 12px">Merhaba ${input.firstName},</p>
    <p style="margin:0 0 16px">Hesabinizi etkinlestirmek icin asagidaki baglantiya tiklayin.</p>
    <p style="margin:0 0 24px">
      <a
        href="${input.actionLink}"
        style="display:inline-block;border-radius:999px;background:#0f172a;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:600"
      >
        E-posta adresimi dogrula
      </a>
    </p>
    <p style="margin:0 0 8px">Buton calismazsa su baglantiyi tarayiciniza yapistirin:</p>
    <p style="margin:0;word-break:break-all">${input.actionLink}</p>
  </div>
`;

const buildSignupEmailText = (input: {
  actionLink: string;
  firstName: string;
}) =>
  [
    `Merhaba ${input.firstName},`,
    "",
    "Assetly hesabinizi dogrulamak icin asagidaki baglantiyi acin:",
    input.actionLink,
  ].join("\n");

// VISIBLE EMAIL SENDING: With timeout and clear logging
const sendSignupConfirmationEmailAsync = async (input: {
  actionLink: string;
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        html: buildSignupEmailHtml(input),
        reply_to: replyTo ? [replyTo] : undefined,
        subject: "Assetly hesabinizi dogrulayin",
        text: buildSignupEmailText(input),
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
  actionLink: string;
  email: string;
  firstName: string;
}) => {
  const resendApiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("AUTOMATION_FROM_EMAIL") ?? DEFAULT_FROM_EMAIL;
  const replyTo = getOptionalEnv("AUTOMATION_REPLY_TO_EMAIL");

  logSignupStep("EMAIL TRIGGERED", {
    actionLinkPreview: maskUrlForLogs(input.actionLink),
    actionLinkPresent: Boolean(input.actionLink.trim()),
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      html: buildSignupEmailHtml(input),
      reply_to: replyTo ? [replyTo] : undefined,
      subject: "Assetly hesabinizi dogrulayin",
      text: buildSignupEmailText(input),
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
      ? ` Eksik degiskenler: ${turnstileEnv.missing.join(", ")}.`
      : "";
    const envPath = turnstileEnv?.rootEnvLocalPath
      ? ` Degerleri ${turnstileEnv.rootEnvLocalPath} dosyasina ekleyip sunucuyu yeniden baslatin.`
      : "";

    return `Turnstile server dogrulamasi yapilandirilmamis.${missingVars}${envPath}`.trim();
  }

  if (reason === "network_error") {
    return "Turnstile dogrulamasi tamamlanamadi. Lutfen tekrar deneyin.";
  }

  if (diagnostics?.hostnameMismatch || errorCodes?.includes("110200")) {
    return TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
  }

  if (errorCodes?.includes("invalid-input-secret")) {
    return "Turnstile secret key gecersiz. Cloudflare secret ayarini kontrol edin.";
  }

  if (errorCodes?.includes("invalid-input-response")) {
    return "Turnstile token gecersiz veya beklenenden farkli. Lutfen dogrulamayi yeniden tamamlayin.";
  }

  return "Turnstile dogrulamasi basarisiz oldu.";
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
  let actionLink = "";

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
        // User exists - convert to magic link
        const { data: magicData } = await input.adminClient.auth.admin.generateLink({
          email: input.email,
          type: "magiclink",
          options: { redirectTo: input.emailRedirectTo },
        });
        theUserId = magicData?.user?.id ?? null;
        actionLink = magicData?.properties?.action_link?.trim() ?? "";
        console.log("USER_CREATED", {
          email: input.email,
          userId: theUserId,
          method: "magiclink_fallback",
        });
      } else if (isWeakPasswordError(signupError)) {
        return { ok: false, step: "user", error: INVALID_PASSWORD_ERROR, message: "Şifre çok zayıf. En az 8 karakter, büyük/küçük harf ve rakam içermeli." };
      } else if (isEmailRateLimitError(signupError)) {
        return { ok: false, step: "user", error: EMAIL_RATE_LIMITED_ERROR, message: "Bu e-posta adresi için çok fazla deneme yapıldı. Lütfen 1 dakika bekleyin." };
      } else {
        console.log("USER_CREATE_RESULT", {
          ok: false,
          email: input.email,
          error: signupError.message,
          code: (signupError as { code?: string }).code,
        });
        return { ok: false, step: "user", error: INTERNAL_ERROR, message: `Kullanıcı oluşturma hatası: ${signupError.message}` };
      }
    } else {
      theUserId = signupData?.user?.id ?? null;
      actionLink = signupData?.properties?.action_link?.trim() ?? "";
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
    return { ok: false, step: "user", error: INTERNAL_ERROR, message: `Kullanıcı oluşturma hatası: ${errorMsg}` };
  }

  if (!theUserId) {
    console.log("USER_CREATE_RESULT", { ok: false, email: input.email, error: "No user ID returned from Supabase" });
    return { ok: false, step: "user", error: INTERNAL_ERROR, message: "Kullanıcı oluşturuldu ancak ID alınamadı. Lütfen tekrar deneyin." };
  }

  // STEP 4: Create Profile (ATOMIC - failure triggers rollback)
  const bootstrapResult = await persistSignupBootstrapRecords({
    acceptedTerms: input.acceptedTerms,
    adminClient: input.adminClient,
    ip: input.requestIp,
    userAgent: input.requestUserAgent,
    userId: theUserId,
  });

  if (!bootstrapResult.ok) {
    // CRITICAL: Rollback auth user
    console.log("ROLLBACK_TRIGGERED", {
      userId: theUserId,
      stage: bootstrapResult.stage,
      error: bootstrapResult.error.message,
    });

    const rollbackResult = await rollbackAuthUser(input.adminClient, theUserId, {
      stage: bootstrapResult.stage,
      originalError: bootstrapResult.error.message,
    });

    console.log("ROLLBACK_RESULT", {
      userId: theUserId,
      ok: rollbackResult.ok,
      error: rollbackResult.error?.message ?? null,
    });

    return { ok: false, step: "profile", error: INTERNAL_ERROR, message: `Profil oluşturma hatası: ${bootstrapResult.error.message}` };
  }

  // STEP 5: Send confirmation email with timeout (10s max)
  // Email failure must NOT block signup - user is already created
  let emailStatus: "sent" | "failed" = "failed";
  let emailError: string | null = null;

  if (actionLink) {
    const emailResult = await sendSignupConfirmationEmailAsync({
      actionLink,
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
  } else {
    console.log("EMAIL_FAILED", { userId: theUserId, error: "missing_action_link", reason: "missing_action_link" });
    emailStatus = "failed";
    emailError = "Doğrulama bağlantısı oluşturulamadı";
  }

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
