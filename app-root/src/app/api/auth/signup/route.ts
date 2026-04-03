import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";
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
  type SignupApiErrorCode,
  type SignupApiErrorResponse,
  type SignupApiSuccessResponse,
  type SignupRisk,
} from "@/lib/supabase/signup";
import {
  logTurnstileEnvDebug,
  readTurnstileServerEnv,
} from "@/lib/env/turnstile-server";

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
  turnstileToken?: unknown;
};

type SignupEmailStatus = "failed" | "sent";

type SignupSuccessResponse = SignupApiSuccessResponse & {
  emailStatus: SignupEmailStatus;
  message: string;
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
  error: SignupApiErrorCode;
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

const logTurnstileDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.info(`${ROUTE_TAG} ${message}`, details ?? {});
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

const buildErrorResponse = (
  error: SignupApiErrorCode,
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
      verified: false,
    },
    {
      headers,
      status,
    },
  );

const buildSuccessResponse = (input: {
  emailStatus: SignupEmailStatus;
  message: string;
  risk: SignupRisk;
}) =>
  NextResponse.json<SignupSuccessResponse>(
    {
      emailStatus: input.emailStatus,
      message: input.message,
      ok: true,
      risk: input.risk,
      verified: true,
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

const getTurnstileFailureMessage = (reason: "invalid" | "missing_secret" | "network_error") => {
  if (reason === "missing_secret") {
    return "Turnstile server verification is not configured. Set TURNSTILE_SECRET_KEY in app-root/.env.local and restart the server.";
  }

  if (reason === "network_error") {
    return "Turnstile verification could not be completed. Please try again.";
  }

  return "Turnstile verification failed.";
};

export async function POST(request: Request) {
  const requestIp = getRequestIp(request);
  const requestUserAgent = request.headers.get("user-agent")?.trim() || null;
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
    console.warn(`${ROUTE_TAG} Signup request failed.`, {
      error: input.error,
      eventType: input.eventType,
      message: input.message,
      metadata: input.metadata ?? null,
      status: input.status,
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
        ...buildRiskMetadata(risk, deviceFingerprint),
      },
      userAgent: requestUserAgent,
      userId: input.userId ?? null,
    });

    return buildErrorResponse(input.error, input.message, input.status, risk, input.headers);
  };

  const turnstileEnv = readTurnstileServerEnv();

  if (!turnstileEnv.secretKey) {
    return fail({
      error: TURNSTILE_FAILED_ERROR,
      eventType: "signup_turnstile_server_unconfigured",
      message: getTurnstileFailureMessage("missing_secret"),
      metadata: {
        missing_env_vars: turnstileEnv.missing,
        root_env_local_path: turnstileEnv.rootEnvLocalPath,
      },
      status: 503,
      turnstileVerified: false,
    });
  }

  try {
    let body: SignupRequestBody;

    try {
      body = (await request.json()) as SignupRequestBody;
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to parse signup request body.`, serializeError(error));
      return buildErrorResponse(
        MISSING_FIELDS_ERROR,
        "Signup request body is invalid.",
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
        error: MISSING_FIELDS_ERROR,
        eventType: "signup_missing_fields",
        message: "First name, last name, email, password, password confirmation, and redirect URL are required.",
        status: 400,
      });
    }

    if (password !== confirmPassword) {
      return fail({
        error: PASSWORD_MISMATCH_ERROR,
        eventType: "signup_password_mismatch",
        message: "Password and password confirmation must match.",
        status: 400,
      });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return fail({
        error: INVALID_EMAIL_ERROR,
        eventType: "signup_invalid_email",
        message: "Please enter a valid email address.",
        status: 400,
      });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return fail({
        error: INVALID_PASSWORD_ERROR,
        eventType: "signup_invalid_password",
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
        status: 400,
      });
    }

    if (!isAllowedEmailRedirect(emailRedirectTo, request)) {
      return fail({
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
        error: TERMS_NOT_ACCEPTED_ERROR,
        eventType: "signup_missing_terms_consent",
        message: "You must accept the Terms of Service to continue.",
        status: 400,
      });
    }

    if (!acceptedPrivacyPolicy) {
      return fail({
        error: PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
        eventType: "signup_missing_privacy_policy_consent",
        message: "You must accept the Privacy Policy to continue.",
        status: 400,
      });
    }

    if (!acceptedKvkk) {
      return fail({
        error: KVKK_CONSENT_REQUIRED_ERROR,
        eventType: "signup_missing_kvkk_consent",
        message: "You must accept the KVKK consent to continue.",
        status: 400,
      });
    }

    if (!turnstileToken) {
      return fail({
        error: TURNSTILE_FAILED_ERROR,
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
      remoteIp: requestIp,
      token: turnstileToken,
    });

    logTurnstileDebug("Turnstile verification result.", {
      action: turnstileVerification.action,
      errorCodes: turnstileVerification.errorCodes,
      hostname: turnstileVerification.hostname,
      ok: turnstileVerification.ok,
      reason: turnstileVerification.ok ? null : turnstileVerification.reason,
    });

    if (!turnstileVerification.ok) {
      return fail({
        error: TURNSTILE_FAILED_ERROR,
        eventType: "signup_turnstile_failed",
        message: getTurnstileFailureMessage(turnstileVerification.reason),
        metadata: {
          turnstile_action: turnstileVerification.action,
          turnstile_error_codes: turnstileVerification.errorCodes,
          turnstile_hostname: turnstileVerification.hostname,
          turnstile_reason: turnstileVerification.reason,
        },
        status: turnstileVerification.reason === "invalid" ? 403 : 503,
        turnstileErrorCodes: turnstileVerification.errorCodes,
        turnstileVerified: false,
      });
    }

    if (!adminClient) {
      return fail({
        error: INTERNAL_ERROR,
        eventType: "signup_admin_client_missing",
        message: "Signup is temporarily unavailable.",
        status: 500,
        turnstileVerified: true,
      });
    }

    try {
      const existingUser = await findExistingAuthUserByEmail({
        adminClient,
        email: normalizedEmail,
      });

      if (existingUser) {
        return fail({
          error: EMAIL_ALREADY_EXISTS_ERROR,
          eventType: "signup_duplicate_email_precheck",
          message: "This email is already registered.",
          metadata: {
            existing_user_id: existingUser.id,
          },
          status: 409,
          turnstileVerified: true,
          userId: existingUser.id,
        });
      }
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

    const { data: signupData, error: signupError } = await adminClient.auth.admin.generateLink({
      email: normalizedEmail,
      options: {
        data: initialUserMetadata,
        redirectTo: emailRedirectTo,
      },
      password,
      type: "signup",
    });

    console.info(`${ROUTE_TAG} Supabase user creation result.`, {
      actionLinkPresent: Boolean(signupData?.properties?.action_link),
      error: signupError,
      userId: signupData?.user?.id ?? null,
    });

    if (signupError) {
      if (isUserAlreadyRegisteredError(signupError)) {
        console.info(`${ROUTE_TAG} Supabase reported duplicate email during signup.`, {
          email: normalizedEmail,
          authErrorCode: signupError.code ?? null,
        });

        return fail({
          error: EMAIL_ALREADY_EXISTS_ERROR,
          eventType: "signup_duplicate_email_supabase",
          message: "This email is already registered.",
          metadata: {
            auth_error_code: signupError.code ?? null,
            auth_error_message: signupError.message ?? null,
            auth_error_status: signupError.status ?? null,
          },
          status: 409,
          turnstileVerified: true,
        });
      }

      if (isEmailRateLimitError(signupError)) {
        return fail({
          error: EMAIL_RATE_LIMITED_ERROR,
          eventType: "signup_supabase_email_rate_limited",
          message: "Supabase email rate limit exceeded.",
          metadata: {
            auth_error_code: signupError.code ?? null,
            auth_error_message: signupError.message ?? null,
            auth_error_status: signupError.status ?? null,
          },
          status: 429,
          triggeredEmailRateLimit: true,
          turnstileVerified: true,
        });
      }

      console.error(`${ROUTE_TAG} Supabase user creation failed.`, {
        authErrorCode: signupError.code ?? null,
        authErrorMessage: signupError.message ?? null,
        authErrorStatus: signupError.status ?? null,
      });

      return fail({
        error: INTERNAL_ERROR,
        eventType: "signup_supabase_error",
        message: "Supabase could not create the user.",
        metadata: {
          auth_error_code: signupError.code ?? null,
          auth_error_message: signupError.message ?? null,
          auth_error_status: signupError.status ?? null,
        },
        status: 500,
        turnstileVerified: true,
      });
    }

    const createdUser = signupData.user;

    if (!createdUser?.id) {
      return fail({
        error: INTERNAL_ERROR,
        eventType: "signup_missing_user_id",
        message: "Supabase did not return a user id for the new signup.",
        status: 500,
        turnstileVerified: true,
      });
    }

    try {
      await persistSignupBootstrapRecords({
        acceptedKvkk: true,
        acceptedPrivacyPolicy: true,
        acceptedTerms: true,
        adminClient,
        email: normalizedEmail,
        ip: requestIp,
        userAgent: requestUserAgent,
        userId: createdUser.id,
      });
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to persist signup bootstrap records.`, {
        error: serializeError(error),
        userId: createdUser.id,
      });

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(createdUser.id);

      console.error(`${ROUTE_TAG} User cleanup result after bootstrap failure.`, {
        deleteError,
        userId: createdUser.id,
      });

      return fail({
        error: INTERNAL_ERROR,
        eventType: "signup_bootstrap_failed",
        message: "User creation could not be completed.",
        metadata: {
          bootstrap_error: error instanceof Error ? error.message : "unknown_bootstrap_error",
          cleanup_error: deleteError?.message ?? null,
        },
        status: 500,
        turnstileVerified: true,
        userId: createdUser.id,
      });
    }

    const actionLink = signupData.properties?.action_link?.trim() || "";
    let emailStatus: SignupEmailStatus = "failed";
    let emailFailureReason: string | null = actionLink ? null : "missing_signup_action_link";

    if (actionLink) {
      try {
        const emailSendResult = await sendSignupConfirmationEmail({
          actionLink,
          email: normalizedEmail,
          firstName,
        });

        emailStatus = "sent";

        console.info(`${ROUTE_TAG} Verification email send result.`, {
          emailSendResult,
          emailStatus,
          userId: createdUser.id,
        });
      } catch (error) {
        emailFailureReason = error instanceof Error ? error.message : "unknown_email_error";

        console.error(`${ROUTE_TAG} Verification email send failed.`, {
          error: serializeError(error),
          provider: "resend",
          userId: createdUser.id,
        });
      }
    } else {
      console.error(`${ROUTE_TAG} Verification email send skipped because Supabase did not return an action link.`, {
        userId: createdUser.id,
      });
    }

    try {
      await updateUserEmailStatus({
        adminClient,
        emailFailureReason,
        emailStatus,
        user: createdUser,
      });
    } catch (error) {
      console.error(`${ROUTE_TAG} Failed to update email status metadata.`, {
        error: serializeError(error),
        userId: createdUser.id,
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
        supabase_user_id: createdUser.id,
        ...buildRiskMetadata(risk, deviceFingerprint),
      },
      userAgent: requestUserAgent,
      userId: createdUser.id,
    });

    return buildSuccessResponse({
      emailStatus,
      message:
        emailStatus === "sent"
          ? "Verification email sent successfully."
          : "Account created, but the verification email could not be sent.",
      risk,
    });
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

    return buildErrorResponse(
      INTERNAL_ERROR,
      error instanceof Error ? error.message : "Unexpected error while creating signup.",
      500,
    );
  }
}
