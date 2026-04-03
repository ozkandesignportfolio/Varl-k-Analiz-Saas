import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  calculateSignupFraudScore,
  recordSignupAttempt,
  recordSignupBotFailure,
  recordSignupRateLimitTrigger,
} from "@/lib/auth/fraud-score";
import { enforceServiceRateLimit, getRequestIp, enforceRateLimit } from "@/lib/api/rate-limit";
import {
  isEmailRateLimitError,
  isSupabaseUserEmailConfirmed,
  isUserAlreadyRegisteredError,
} from "@/lib/supabase/auth-errors";
import {
  BOT_DETECTED_ERROR,
  EMAIL_ALREADY_EXISTS_ERROR,
  EMAIL_CONFIRMATION_DISABLED_ERROR,
  EMAIL_RATE_LIMITED_ERROR,
  INVALID_EMAIL_ERROR,
  RATE_LIMITED_ERROR,
  SIGNUP_FAILED_ERROR,
  TERMS_NOT_ACCEPTED_ERROR,
} from "@/lib/supabase/signup";

export const runtime = "nodejs";

const SIGNUP_IP_RATE_LIMIT_CAPACITY = 1;
const SIGNUP_IP_RATE_LIMIT_REFILL_PER_SECOND = SIGNUP_IP_RATE_LIMIT_CAPACITY / 60;
const SIGNUP_IP_RATE_LIMIT_WINDOW_MS = 60_000;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SignupRequestBody = {
  acceptedTerms?: unknown;
  email?: unknown;
  fullName?: unknown;
  password?: unknown;
  emailRedirectTo?: unknown;
  turnstileToken?: unknown;
};

const notificationPreferences = {
  maintenance: true,
  maintenance_email: true,
  warranty: true,
  warranty_email: true,
  document: true,
  document_email: true,
  documentExpiry: true,
  document_expiry: true,
  document_expiry_email: true,
  service: true,
  service_logs: true,
  service_log: true,
  service_email: true,
  payment: true,
  subscription_email: true,
  system: true,
  inApp: true,
  in_app: true,
  email: true,
  frequency: "Aninda",
};

const getRequiredEnv = (key: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const getSupabaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || null;

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

const getServiceRoleClient = () => {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const hashIpForRateLimitSubject = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 32);

const logFraudScore = (
  ipHash: string,
  fraudScore: Awaited<ReturnType<typeof calculateSignupFraudScore>>,
  outcome: string,
) => {
  console.info(
    JSON.stringify({
      event: "auth:signup_fraud_score",
      ts: new Date().toISOString(),
      ip_hash: ipHash,
      outcome,
      fraud_score: fraudScore.score,
      fraud_reason: fraudScore.reason,
      meta: {
        attempts_last_10m: fraudScore.attemptsLast10m,
        bot_failures_last_10m: fraudScore.botFailuresLast10m,
        rapid_retries_last_10m: fraudScore.rapidRetriesLast10m,
        rate_limit_triggers_last_10m: fraudScore.rateLimitTriggersLast10m,
        disposable_email: fraudScore.disposableEmail,
        invalid_email: fraudScore.invalidEmail,
        email_domain: fraudScore.emailDomain,
      },
    }),
  );
};

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

const verifyTurnstileToken = async (token: string, remoteIp: string) => {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secretKey || !token.trim()) {
    return false;
  }

  const body = new URLSearchParams();
  body.set("secret", secretKey);
  body.set("response", token.trim());

  if (remoteIp && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as TurnstileVerifyResponse | null;
    return payload?.success === true;
  } catch (error) {
    console.error("[auth.signup] Turnstile verification failed.", error);
    return false;
  }
};

export async function POST(request: Request) {
  try {
    const requestIp = getRequestIp(request);
    const ipSubject = `signup_ip_${hashIpForRateLimitSubject(requestIp)}`;
    const requestUserAgent = request.headers.get("user-agent");
    const body = (await request.json()) as SignupRequestBody;
    const acceptedTerms = body.acceptedTerms === true;
    const fullName = isNonEmptyString(body.fullName) ? body.fullName.trim() : "";
    const email = isNonEmptyString(body.email) ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const emailRedirectTo = isNonEmptyString(body.emailRedirectTo) ? body.emailRedirectTo.trim() : "";
    const turnstileToken = isNonEmptyString(body.turnstileToken) ? body.turnstileToken.trim() : "";
    const serviceRoleClient = getServiceRoleClient();
    await recordSignupAttempt(requestIp);

    const rateLimit = serviceRoleClient
      ? await enforceServiceRateLimit({
          client: serviceRoleClient,
          scope: "api_auth_signup_ip",
          subject: ipSubject,
          capacity: SIGNUP_IP_RATE_LIMIT_CAPACITY,
          refillPerSecond: SIGNUP_IP_RATE_LIMIT_REFILL_PER_SECOND,
          ttlSeconds: 180,
        })
      : enforceRateLimit({
          scope: "api_auth_signup_ip_memory_fallback",
          key: ipSubject,
          limit: SIGNUP_IP_RATE_LIMIT_CAPACITY,
          windowMs: SIGNUP_IP_RATE_LIMIT_WINDOW_MS,
        });

    if (!rateLimit.allowed) {
      await recordSignupRateLimitTrigger(requestIp);
      const fraudScore = await calculateSignupFraudScore({
        email,
        ip: requestIp,
        rateLimitTriggered: true,
        turnstileToken,
        userAgent: requestUserAgent,
      });
      logFraudScore(ipSubject, fraudScore, RATE_LIMITED_ERROR);
      return NextResponse.json(
        { error: RATE_LIMITED_ERROR },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const baseFraudScore = await calculateSignupFraudScore({
      email,
      ip: requestIp,
      turnstileToken,
      userAgent: requestUserAgent,
    });

    if (baseFraudScore.invalidEmail) {
      logFraudScore(ipSubject, baseFraudScore, INVALID_EMAIL_ERROR);
      return NextResponse.json({ error: INVALID_EMAIL_ERROR }, { status: 400 });
    }

    const isTurnstileValid = await verifyTurnstileToken(turnstileToken, requestIp);
    if (!isTurnstileValid) {
      await recordSignupBotFailure(requestIp);
      const fraudScore = await calculateSignupFraudScore({
        email,
        ip: requestIp,
        turnstileToken,
        turnstileVerified: false,
        userAgent: requestUserAgent,
      });
      logFraudScore(ipSubject, fraudScore, BOT_DETECTED_ERROR);
      return NextResponse.json({ error: BOT_DETECTED_ERROR }, { status: 403 });
    }

    if (!acceptedTerms) {
      const fraudScore = await calculateSignupFraudScore({
        email,
        ip: requestIp,
        turnstileToken,
        turnstileVerified: true,
        userAgent: requestUserAgent,
      });
      logFraudScore(ipSubject, fraudScore, TERMS_NOT_ACCEPTED_ERROR);
      return NextResponse.json({ error: TERMS_NOT_ACCEPTED_ERROR }, { status: 400 });
    }

    if (!fullName || !email || !password || !emailRedirectTo) {
      const fraudScore = await calculateSignupFraudScore({
        email,
        ip: requestIp,
        turnstileToken,
        turnstileVerified: true,
        userAgent: requestUserAgent,
      });
      logFraudScore(ipSubject, fraudScore, SIGNUP_FAILED_ERROR);
      return NextResponse.json(
        {
          error: SIGNUP_FAILED_ERROR,
          message: "Missing required signup fields.",
        },
        { status: 400 },
      );
    }

    const signUpClient = getSignUpClient();
    const { data, error } = await signUpClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
          notification_preferences: notificationPreferences,
          notificationPreferences,
        },
      },
    });

    if (error) {
      const fraudScore = await calculateSignupFraudScore({
        email,
        ip: requestIp,
        turnstileToken,
        turnstileVerified: true,
        userAgent: requestUserAgent,
      });

      if (isUserAlreadyRegisteredError(error)) {
        logFraudScore(ipSubject, fraudScore, EMAIL_ALREADY_EXISTS_ERROR);
        return NextResponse.json({ error: EMAIL_ALREADY_EXISTS_ERROR }, { status: 409 });
      }

      if (isEmailRateLimitError(error)) {
        logFraudScore(ipSubject, fraudScore, EMAIL_RATE_LIMITED_ERROR);
        return NextResponse.json({ error: EMAIL_RATE_LIMITED_ERROR }, { status: 429 });
      }

      logFraudScore(ipSubject, fraudScore, SIGNUP_FAILED_ERROR);
      return NextResponse.json(
        {
          error: SIGNUP_FAILED_ERROR,
          message: error.message || "Signup failed.",
        },
        { status: 400 },
      );
    }

    if (data.session && data.user && isSupabaseUserEmailConfirmed(data.user)) {
      const fraudScore = await calculateSignupFraudScore({
        email,
        ip: requestIp,
        turnstileToken,
        turnstileVerified: true,
        userAgent: requestUserAgent,
      });
      logFraudScore(ipSubject, fraudScore, EMAIL_CONFIRMATION_DISABLED_ERROR);
      return NextResponse.json({ error: EMAIL_CONFIRMATION_DISABLED_ERROR }, { status: 409 });
    }

    const successFraudScore = await calculateSignupFraudScore({
      email,
      ip: requestIp,
      turnstileToken,
      turnstileVerified: true,
      userAgent: requestUserAgent,
    });
    logFraudScore(ipSubject, successFraudScore, "signup_started");
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[auth.signup] Failed to create signup.", error);
    return NextResponse.json(
      {
        error: SIGNUP_FAILED_ERROR,
        message: "Kayit sirasinda beklenmeyen bir hata olustu.",
      },
      { status: 500 },
    );
  }
}
