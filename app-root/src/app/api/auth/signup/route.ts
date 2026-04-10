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
  KVKK_CONSENT_REQUIRED_ERROR,
  MISSING_FIELDS_ERROR,
  normalizeEmail,
  PASSWORD_MISMATCH_ERROR,
  PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
  RATE_LIMITED_ERROR,
  TERMS_NOT_ACCEPTED_ERROR,
  TURNSTILE_FAILED_ERROR,
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

type SignupRequestBody = {
  acceptedKvkk?: unknown;
  acceptedPrivacyPolicy?: unknown;
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

const persistSignupBootstrapRecords = async (input: {
  acceptedKvkk: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedTerms: boolean;
  adminClient: ReturnType<typeof createAdminClient>;
  email: string;
  ip: string;
  userAgent: string | null;
  userId: string;
}) => {
  const consentedAt = new Date().toISOString();

  const { error: profileError } = await input.adminClient.from("profiles").upsert(
    {
      id: input.userId,
      plan: "free",
    },
    { onConflict: "id" },
  );

  console.info(`${ROUTE_TAG} User profile bootstrap result.`, {
    profileError,
    userId: input.userId,
  });

  if (profileError) {
    throw new Error(`Failed to upsert profile: ${profileError.message}`);
  }

  const { error: notificationError } = await input.adminClient.from("notification_settings").upsert(
    {
      user_id: input.userId,
    },
    { onConflict: "user_id" },
  );

  console.info(`${ROUTE_TAG} Notification settings bootstrap result.`, {
    notificationError,
    userId: input.userId,
  });

  if (notificationError) {
    throw new Error(`Failed to upsert notification settings: ${notificationError.message}`);
  }

  const { error: consentError } = await input.adminClient.from("user_consents").insert({
    accepted_kvkk: input.acceptedKvkk,
    accepted_privacy_policy: input.acceptedPrivacyPolicy,
    accepted_terms: input.acceptedTerms,
    consented_at: consentedAt,
    email: input.email,
    ip: input.ip,
    user_agent: input.userAgent,
    user_id: input.userId,
  });

  console.info(`${ROUTE_TAG} Consent bootstrap result.`, {
    consentError,
    userId: input.userId,
  });

  if (consentError) {
    throw new Error(`Failed to insert user consent: ${consentError.message}`);
  }
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

export async function POST(request: Request) {
  const requestIp = getRequestIp(request);
  const requestUserAgent = request.headers.get("user-agent")?.trim() || null;
  const {
    headers: {
      host: hostHeader,
      origin,
      xForwardedHost: forwardedHost,
    },
    requestHostname: requestHost,
  } = getTurnstileRequestContext(request);
  console.info(`${ROUTE_TAG} Request host headers.`, {
    host: hostHeader,
    hostname: requestHost,
    origin,
    xForwardedHost: forwardedHost,
  });
  logTurnstileEnvDebug(`${ROUTE_TAG} request_start`);
  const adminClient = (() => {
    try {
      return createAdminClient();
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to initialize Supabase admin client.`, serializeError(error));
      return null;
    }
  })();

  let normalizedEmail = "";
  let deviceFingerprint = UNKNOWN_DEVICE_FINGERPRINT;
  let turnstileToken = "";

  const fail = async (input: FailureResponseInput) => {
    logReturnReason(input.eventType, {
      error: input.error,
      message: input.message,
      status: input.status,
      turnstileCategory: input.turnstile
        ? getTurnstileFailureCategory({
            errorCodes: input.turnstile.errorCodes,
            hostnameMismatch: input.turnstile.hostnameMismatch,
            issue: input.turnstile.issue,
          })
        : null,
      turnstileVerified: input.turnstileVerified ?? false,
    });

    console.warn(`${ROUTE_TAG} Signup request failed.`, {
      error: input.error,
      eventType: input.eventType,
      message: input.message,
      metadata: input.metadata ?? null,
      status: input.status,
      turnstile: input.turnstile ?? null,
      turnstileVerified: input.turnstileVerified ?? false,
    });

    const risk = await evaluateRiskSafely({
      deviceFingerprint,
      email: normalizedEmail || "unknown@example.com",
      emailRateLimited: input.triggeredEmailRateLimit,
      ip: requestIp,
      ipRateLimited: input.triggeredIpRateLimit,
      outcome: input.eventType,
      turnstileErrorCodes: input.turnstileErrorCodes,
      turnstileTokenPresent: Boolean(turnstileToken),
      turnstileVerified: input.turnstileVerified ?? false,
      userAgent: requestUserAgent,
    });

    await safeLogSecurityEvent(adminClient, {
      email: normalizedEmail || null,
      eventType: input.eventType,
      ip: requestIp,
      metadata: {
        ...(input.metadata ?? {}),
        turnstile: input.turnstile ?? null,
        ...buildRiskMetadata(risk, deviceFingerprint),
      },
      userAgent: requestUserAgent,
      userId: input.userId ?? null,
    });

    return buildErrorResponse(
      input.error,
      input.message,
      input.status,
      risk,
      input.headers,
      input.turnstile,
      input.details,
    );
  };

  const turnstileEnv = readTurnstileServerEnv();
  const isLocalhostRequest = canUseLocalhostTurnstileTestKeys(requestHost);

  if (turnstileEnv.missing.length > 0 && !isLocalhostRequest) {
    return fail({
      step: "captcha",
      error: TURNSTILE_FAILED_ERROR,
      reason: "turnstile_server_misconfigured",
      shouldResetTurnstile: false,
      eventType: "signup_turnstile_server_unconfigured",
      message: getTurnstileFailureMessage("missing_secret", turnstileEnv),
      metadata: {
        missing_env_vars: turnstileEnv.missing,
        request_forwarded_host: forwardedHost,
        request_host: requestHost,
        request_host_header: hostHeader,
        request_origin: origin,
        root_env_local_path: turnstileEnv.rootEnvLocalPath,
      },
      status: 503,
      turnstile: {
        errorCodes: [],
        hostnameMismatch: false,
        issue: "env",
        requestHostname: requestHost,
        responseHostname: null,
      },
      turnstileVerified: false,
    });
  }

  try {
    let body: SignupRequestBody;

    try {
      body = (await request.json()) as SignupRequestBody;
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to parse signup request body.`, serializeError(error));
      logReturnReason("signup_invalid_request_body", {
        error: MISSING_FIELDS_ERROR,
        status: 400,
      });
      return buildResponse(
        {
          ok: false,
          step: "user",
          status: "failed",
          error: MISSING_FIELDS_ERROR,
          message: "Signup request body is invalid.",
        },
        crypto.randomUUID(),
        400,
      );
    }

    const acceptedTerms = body.acceptedTerms === true;
    const acceptedPrivacyPolicy = body.acceptedPrivacyPolicy === true;
    const acceptedKvkk = body.acceptedKvkk === true;
    const firstName = isNonEmptyString(body.firstName) ? body.firstName.trim() : "";
    const lastName = isNonEmptyString(body.lastName) ? body.lastName.trim() : "";
    const email = isNonEmptyString(body.email) ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    const emailRedirectTo = isNonEmptyString(body.emailRedirectTo) ? body.emailRedirectTo.trim() : "";
    turnstileToken = isNonEmptyString(body.turnstileToken) ? body.turnstileToken.trim() : "";
    deviceFingerprint = normalizeDeviceFingerprint(body.deviceFingerprint);
    normalizedEmail = email ? normalizeEmail(email) : "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    logTurnstileDebug("Turnstile token received.", {
      tokenLength: turnstileToken.length,
      tokenPresent: Boolean(turnstileToken),
      tokenPreview: maskTokenForLogs(turnstileToken),
    });

    console.info(`${ROUTE_TAG} Fingerprint generation status.`, {
      fingerprintStatus: isUnknownDeviceFingerprint(deviceFingerprint) ? "fallback" : "captured",
    });

    if (!firstName || !lastName || !normalizedEmail || !password || !confirmPassword || !emailRedirectTo) {
      return fail({
        step: "user",
        error: MISSING_FIELDS_ERROR,
        eventType: "signup_missing_fields",
        message: "First name, last name, email, password, password confirmation, and redirect URL are required.",
        status: 400,
      });
    }

    if (password !== confirmPassword) {
      return fail({
        step: "user",
        error: PASSWORD_MISMATCH_ERROR,
        eventType: "signup_password_mismatch",
        message: "Password and password confirmation must match.",
        status: 400,
      });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return fail({
        step: "user",
        error: INVALID_EMAIL_ERROR,
        eventType: "signup_invalid_email",
        message: "Please enter a valid email address.",
        status: 400,
      });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return fail({
        step: "user",
        error: INVALID_PASSWORD_ERROR,
        eventType: "signup_invalid_password",
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
        status: 400,
      });
    }

    if (!isAllowedEmailRedirect(emailRedirectTo, request)) {
      return fail({
        step: "user",
        error: INVALID_REDIRECT_URL_ERROR,
        eventType: "signup_invalid_redirect_url",
        message: "The signup redirect URL is invalid.",
        metadata: {
          emailRedirectTo,
        },
        status: 400,
      });
    }

    if (!acceptedTerms) {
      return fail({
        step: "user",
        error: TERMS_NOT_ACCEPTED_ERROR,
        eventType: "signup_missing_terms_consent",
        message: "You must accept the Terms of Service to continue.",
        status: 400,
      });
    }

    if (!acceptedPrivacyPolicy) {
      return fail({
        step: "user",
        error: PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
        eventType: "signup_missing_privacy_policy_consent",
        message: "You must accept the Privacy Policy to continue.",
        status: 400,
      });
    }

    if (!acceptedKvkk) {
      return fail({
        step: "user",
        error: KVKK_CONSENT_REQUIRED_ERROR,
        eventType: "signup_missing_kvkk_consent",
        message: "You must accept the KVKK consent to continue.",
        status: 400,
      });
    }

    if (!turnstileToken) {
      return fail({
        step: "captcha",
        error: TURNSTILE_FAILED_ERROR,
        reason: "turnstile_missing",
        shouldResetTurnstile: true,
        eventType: "signup_turnstile_missing_token",
        message: "Please complete the Turnstile verification.",
        status: 400,
      });
    }

    const ipRateLimit = await takeRateLimitSafely({
      limit: SIGNUP_IP_RATE_LIMIT_CAPACITY,
      requestIp,
      scope: "auth_signup_ip",
      subject: requestIp,
      windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
    });

    if (!ipRateLimit.allowed) {
      return fail({
        step: "user",
        error: RATE_LIMITED_ERROR,
        eventType: "signup_rate_limited_ip",
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(ipRateLimit.retryAfterMs / 1_000))),
        },
        message: "Too many signup attempts from this IP address. Please try again shortly.",
        metadata: {
          limit: SIGNUP_IP_RATE_LIMIT_CAPACITY,
          retry_after_ms: ipRateLimit.retryAfterMs,
          scope: "ip",
          window_ms: SIGNUP_RATE_LIMIT_WINDOW_MS,
        },
        status: 429,
        triggeredIpRateLimit: true,
      });
    }

    const emailRateLimit = await takeRateLimitSafely({
      limit: SIGNUP_EMAIL_RATE_LIMIT_CAPACITY,
      requestIp,
      scope: "auth_signup_email",
      subject: normalizedEmail,
      windowMs: SIGNUP_RATE_LIMIT_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return fail({
        step: "user",
        error: EMAIL_RATE_LIMITED_ERROR,
        eventType: "signup_rate_limited_email",
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(emailRateLimit.retryAfterMs / 1_000))),
        },
        message: "Too many signup attempts for this email address. Please try again shortly.",
        metadata: {
          limit: SIGNUP_EMAIL_RATE_LIMIT_CAPACITY,
          retry_after_ms: emailRateLimit.retryAfterMs,
          scope: "email",
          window_ms: SIGNUP_RATE_LIMIT_WINDOW_MS,
        },
        status: 429,
        triggeredEmailRateLimit: true,
      });
    }

    const turnstileVerification = await verifyTurnstileToken({
      requestHost,
      remoteIp: requestIp,
      token: turnstileToken,
    });
    const turnstileDiagnostics: SignupApiTurnstileDiagnostics = {
      errorCodes: turnstileVerification.errorCodes,
      hostnameMismatch: turnstileVerification.hostnameMismatch,
      issue: turnstileVerification.issue,
      requestHostname: turnstileVerification.requestHostname,
      responseHostname: turnstileVerification.hostname,
    };

    logTurnstileDebug("Turnstile verification result.", {
      action: turnstileVerification.action,
      category: turnstileVerification.ok
        ? null
        : getTurnstileFailureCategory({
            errorCodes: turnstileVerification.errorCodes,
            hostnameMismatch: turnstileVerification.hostnameMismatch,
            issue: turnstileVerification.issue,
          }),
      errorCodes: turnstileVerification.errorCodes,
      hostnameMismatch: turnstileVerification.hostnameMismatch,
      hostname: turnstileVerification.hostname,
      issue: turnstileVerification.issue,
      ok: turnstileVerification.ok,
      requestHostname: turnstileVerification.requestHostname,
      reason: turnstileVerification.ok ? null : turnstileVerification.reason,
      success: turnstileVerification.ok,
      tokenPresent: Boolean(turnstileToken),
    });

    console.info(`${ROUTE_TAG} Turnstile verification audit.`, {
      errorCodes: turnstileVerification.errorCodes,
      failureCategory: turnstileVerification.ok
        ? null
        : getTurnstileFailureCategory({
            errorCodes: turnstileVerification.errorCodes,
            hostnameMismatch: turnstileVerification.hostnameMismatch,
            issue: turnstileVerification.issue,
          }),
      hostname: turnstileVerification.hostname,
      success: turnstileVerification.ok,
      tokenPresent: Boolean(turnstileToken),
    });

    if (turnstileVerification.hostnameMismatch) {
      return fail({
        step: "captcha",
        error: TURNSTILE_FAILED_ERROR,
        reason: "turnstile_hostname_mismatch",
        shouldResetTurnstile: false,
        eventType: "signup_turnstile_hostname_mismatch",
        message: getTurnstileFailureMessage("invalid", turnstileEnv, turnstileVerification.errorCodes, turnstileDiagnostics),
        metadata: {
          request_forwarded_host: forwardedHost,
          request_host: requestHost,
          request_host_header: hostHeader,
          request_origin: origin,
          turnstile_action: turnstileVerification.action,
          turnstile_error_codes: turnstileVerification.errorCodes,
          turnstile_hostname: turnstileVerification.hostname,
          turnstile_issue: turnstileVerification.issue,
          turnstile_reason: "hostname_mismatch",
        },
        status: 403,
        turnstile: turnstileDiagnostics,
        turnstileErrorCodes: turnstileVerification.errorCodes,
        turnstileVerified: false,
      });
    }

    if (!turnstileVerification.ok) {
      return fail({
        step: "captcha",
        error: TURNSTILE_FAILED_ERROR,
        reason: "turnstile_invalid_or_expired",
        shouldResetTurnstile: true,
        eventType: "signup_turnstile_failed",
        message: getTurnstileFailureMessage(
          turnstileVerification.reason,
          turnstileEnv,
          turnstileVerification.errorCodes,
          turnstileDiagnostics,
        ),
        metadata: {
          request_forwarded_host: forwardedHost,
          request_host: requestHost,
          request_host_header: hostHeader,
          request_origin: origin,
          turnstile_action: turnstileVerification.action,
          turnstile_error_codes: turnstileVerification.errorCodes,
          turnstile_hostname: turnstileVerification.hostname,
          turnstile_issue: turnstileVerification.issue,
          turnstile_reason: turnstileVerification.reason,
        },
        status: turnstileVerification.reason === "invalid" ? 403 : 503,
        turnstile: turnstileDiagnostics,
        turnstileErrorCodes: turnstileVerification.errorCodes,
        turnstileVerified: false,
      });
    }

    console.info(`${ROUTE_TAG} TURNSTILE_RESULT`, {
      ok: true,
      step: "captcha",
      hostname: turnstileVerification.hostname,
      requestHostname: turnstileVerification.requestHostname,
      tokenPresent: Boolean(turnstileToken),
      errorCodes: turnstileVerification.errorCodes,
      issue: turnstileVerification.issue,
    });

    if (!adminClient) {
      return fail({
        step: "user",
        error: INTERNAL_ERROR,
        eventType: "signup_admin_client_missing",
        message: "Signup is temporarily unavailable.",
        status: 500,
        turnstileVerified: true,
      });
    }

    let existingUser: any = null;
    try {
      existingUser = await findExistingAuthUserByEmail({
        adminClient,
        email: normalizedEmail,
      });
    } catch (error) {
      console.error(`${ROUTE_TAG} Duplicate email precheck failed. Continuing with Supabase signup fallback.`, {
        email: normalizedEmail,
        error: serializeError(error),
      });
    }

    const initialUserMetadata = {
      email_status: "pending",
      first_name: firstName,
      full_name: fullName,
      last_name: lastName,
      legal_consents: {
        accepted_kvkk: true,
        accepted_privacy_policy: true,
        accepted_terms: true,
        consented_at: new Date().toISOString(),
      },
      notification_preferences: notificationPreferences,
    };

    let theUserId: string | null = null;
    let fallbackToMagicLink = false;
    let fallbackDataProp: any = null;

    if (existingUser) {
      console.info(`${ROUTE_TAG} [STEP] USER_EXISTS - Converting to magic link for idempotency`, {
        email: normalizedEmail,
        userId: existingUser.id,
      });
      theUserId = existingUser.id;
      fallbackToMagicLink = true;
    } else {
      const { data: signupData, error: signupError } = await adminClient.auth.admin.generateLink({
        email: normalizedEmail,
        options: {
          data: initialUserMetadata,
          redirectTo: emailRedirectTo,
        },
        password,
        type: "signup",
      });

      if (signupError) {
        const serializedSignupError = serializeSupabaseAuthError(signupError);

        if (isUserAlreadyRegisteredError(signupError)) {
          console.info(`${ROUTE_TAG} [STEP] USER_EXISTS (RACE CONDITION CAUGHT) - Converting to magic link`, {
            email: normalizedEmail,
          });
          fallbackToMagicLink = true;
        } else if (isWeakPasswordError(signupError)) {
          return fail({
            step: "user",
            error: INVALID_PASSWORD_ERROR,
            eventType: "signup_supabase_weak_password",
            message: serializedSignupError.weakPasswordMessage ?? "Password does not meet requirements.",
            status: 400,
            turnstileVerified: true,
          });
        } else if (isEmailRateLimitError(signupError)) {
          return fail({
            step: "user",
            error: EMAIL_RATE_LIMITED_ERROR,
            eventType: "signup_supabase_email_rate_limited",
            message: "Supabase email rate limit exceeded.",
            status: 429,
            triggeredEmailRateLimit: true,
            turnstileVerified: true,
          });
        } else {
          const errorMessage = signupError?.message || "Supabase user creation failed";
          const errorCode = (signupError as any)?.code || "unknown";
          console.error(`${ROUTE_TAG} USER_CREATE_RESULT`, {
            ok: false,
            step: "user",
            error: INTERNAL_ERROR,
            reason: "supabase_error",
            supabaseError: serializedSignupError,
            errorCode,
            errorMessage,
          });
          return fail({
            step: "user",
            error: INTERNAL_ERROR,
            reason: "supabase_error",
            eventType: "signup_supabase_error",
            message: `Kullanıcı oluşturulamadı: ${errorMessage}`,
            status: 500,
            turnstileVerified: true,
          });
        }
      } else {
        theUserId = signupData?.user?.id ?? null;
        fallbackDataProp = signupData?.properties ?? null;
      }
    }

    if (fallbackToMagicLink) {
      const { data: fallbackData } = await adminClient.auth.admin.generateLink({
        email: normalizedEmail,
        type: "magiclink",
        options: { redirectTo: emailRedirectTo },
      });
      theUserId = fallbackData?.user?.id ?? existingUser?.id ?? null;
      fallbackDataProp = fallbackData?.properties ?? null;
    }

    if (!theUserId) {
      return fail({
        step: "user",
        error: INTERNAL_ERROR,
        eventType: "signup_missing_user_id",
        message: "Supabase did not return a user id for the new signup.",
        status: 500,
        turnstileVerified: true,
      });
    }

    console.info(`${ROUTE_TAG} USER_CREATE_RESULT`, {
      ok: true,
      step: "user",
      email: normalizedEmail,
      userId: theUserId,
      method: fallbackToMagicLink ? "magiclink" : "signup",
    });

    try {
      await persistSignupBootstrapRecords({
        acceptedKvkk: true,
        acceptedPrivacyPolicy: true,
        acceptedTerms: true,
        adminClient,
        email: normalizedEmail,
        ip: requestIp,
        userAgent: requestUserAgent,
        userId: theUserId,
      });
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to persist signup bootstrap records.`, {
        error: serializeError(error),
        userId: theUserId,
      });

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(theUserId);

      return fail({
        step: "user",
        error: INTERNAL_ERROR,
        eventType: "signup_bootstrap_failed",
        message: "Supabase user was created but the signup bootstrap records could not be completed.",
        status: 500,
        turnstileVerified: true,
      });
    }

    const actionLink = fallbackDataProp?.action_link?.trim() || "";
    let emailStatus: SignupEmailStatus = "failed";
    let emailFailureReason: string | null = actionLink ? null : "missing_signup_action_link";

    if (actionLink) {
      try {
        await sendSignupConfirmationEmail({
          actionLink,
          email: normalizedEmail,
          firstName,
        });
        emailStatus = "sent";
        console.info(`${ROUTE_TAG} EMAIL_RESULT`, {
          ok: true,
          step: "email",
          email: normalizedEmail,
          userId: theUserId,
          status: "sent",
        });
      } catch (error) {
        emailFailureReason = error instanceof Error ? error.message : "unknown_email_error";
        console.error(`${ROUTE_TAG} EMAIL_RESULT`, {
          ok: false,
          step: "email",
          email: normalizedEmail,
          userId: theUserId,
          status: "failed",
          error: emailFailureReason,
        });
      }
    } else {
      console.error(`${ROUTE_TAG} Verification email send skipped because Supabase did not return an action link.`, {
        userId: theUserId,
      });
    }

    try {
      await updateUserEmailStatus({
        adminClient,
        emailFailureReason,
        emailStatus,
        user: { id: theUserId } as any,
      });
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to update email status metadata.`, {
        error: serializeError(error),
        userId: theUserId,
      });
    }

    const risk = await evaluateRiskSafely({
      deviceFingerprint,
      email: normalizedEmail,
      ip: requestIp,
      outcome: emailStatus === "sent" ? "signup_success" : "signup_success_email_failed",
      turnstileTokenPresent: true,
      turnstileVerified: true,
      userAgent: requestUserAgent,
    });

    await safeLogSecurityEvent(adminClient, {
      email: normalizedEmail,
      eventType: emailStatus === "sent" ? "signup_success" : "signup_success_email_failed",
      ip: requestIp,
      metadata: {
        email_failure_reason: emailFailureReason,
        email_status: emailStatus,
        session_created: false,
        supabase_user_id: theUserId,
        ...buildRiskMetadata(risk, deviceFingerprint),
      },
      userAgent: requestUserAgent,
      userId: theUserId,
    });

    return buildResponse(
      {
        ok: true,
        step: emailStatus === "sent" ? "email" : "user",
        status: "success",
        message:
          emailStatus === "sent"
            ? "Verification email sent successfully."
            : "Account created, but the verification email could not be sent.",
        risk,
        verified: true,
        emailStatus,
      },
      crypto.randomUUID(),
    );
  } catch (error) {
    console.error(`${ROUTE_TAG} Unhandled signup error.`, serializeError(error));

    await safeLogSecurityEvent(adminClient, {
      email: normalizedEmail || null,
      eventType: "signup_unhandled_error",
      ip: requestIp,
      metadata: {
        error: serializeError(error),
      },
      userAgent: requestUserAgent,
    });

    logReturnReason("signup_unhandled_error", {
      error: error instanceof Error ? error.message : "unknown_error",
      status: 500,
    });

    return buildResponse(
      {
        ok: false,
        step: "user",
        status: "failed",
        error: INTERNAL_ERROR,
        message: error instanceof Error && error.message.trim() ? error.message : "Supabase user creation failed unexpectedly.",
      },
      crypto.randomUUID(),
      500,
    );
  }
}
