import "server-only";
import { z } from "zod";

if (typeof window !== "undefined") {
  console.warn("ServerEnv accessed in client bundle");
}

type NodeEnv = "development" | "test" | "production";

const requiredServerEnvKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
] as const;

type RequiredServerEnvKey = (typeof requiredServerEnvKeys)[number];

const normalizeEnvValue = (value: string | undefined): string => {
  const normalized = value?.trim();
  return normalized ? normalized : "";
};

const optionalEnvSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional();

const serverEnvValidationSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  STRIPE_SECRET_KEY: z
    .string()
    .trim()
    .regex(/^sk_(test|live)_/, "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_"),
  STRIPE_WEBHOOK_SECRET: z.string().trim().min(1),
  TURNSTILE_SECRET_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().trim().min(1),
  DATABASE_URL: optionalEnvSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnvValidated = z.infer<typeof serverEnvValidationSchema>;

const readServerEnvForValidation = (): Record<string, unknown> => ({
  SUPABASE_SERVICE_ROLE_KEY: readRawServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  NEXT_PUBLIC_SUPABASE_URL: readRawServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: readRawServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  STRIPE_SECRET_KEY: readRawServerEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: readRawServerEnv("STRIPE_WEBHOOK_SECRET"),
  TURNSTILE_SECRET_KEY: readRawServerEnv("TURNSTILE_SECRET_KEY"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: readRawServerEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
  DATABASE_URL: readRawServerEnv("DATABASE_URL"),
  NODE_ENV: readRawServerEnv("NODE_ENV") || "development",
});

const parseServerEnvValidation = () => serverEnvValidationSchema.safeParse(readServerEnvForValidation());

export const validateServerEnvPayloadForTests = (payload: Record<string, unknown>) =>
  serverEnvValidationSchema.safeParse(payload);

const readRawServerEnv = (key: string): string => {
  if (typeof process === "undefined") {
    return "";
  }

  return normalizeEnvValue(process.env[key]);
};

const readOptionalServerEnv = (key: string): string | null => {
  const value = readRawServerEnv(key);
  return value.length > 0 ? value : null;
};

export const readServerEnvOptional = (key: string): string | null => readOptionalServerEnv(key);

const readRequiredServerEnv = (key: RequiredServerEnvKey): string => {
  const value = readRawServerEnv(key);
  if (value.length > 0) {
    return value;
  }

  throw new Error(`[server-env] Missing required environment variable: ${key}`);
};

export const requireEnv = (key: string): string => {
  const value = readRawServerEnv(key);
  if (value.length > 0) {
    return value;
  }

  throw new Error(`[server-env] Missing required environment variable: ${key}`);
};

const coerceNodeEnv = (): NodeEnv => {
  const value = readRawServerEnv("NODE_ENV");
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  return "development";
};

const parseBooleanEnv = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  return value.toLowerCase() === "true";
};

export const getServerEnvIssues = (): string[] => {
  const result = parseServerEnvValidation();
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
};

type ServerEnvShape = Readonly<{
  SUPABASE_SERVICE_ROLE_KEY: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: string;
  APP_URL: string | null;
  NODE_ENV: NodeEnv;
  STRIPE_ALLOW_LIVE_IN_NON_PROD: boolean;
  AUTH_FORCE_PROFILE_FROM_DB: string | null;
  OPENAI_MODEL: string | null;
  OPENAI_TRANSCRIBE_MODEL: string | null;
  UPSTASH_REDIS_REST_URL: string | null;
  UPSTASH_REDIS_REST_TOKEN: string | null;
  ADMIN_DASHBOARD_SECRET: string | null;
  ALERT_WEBHOOK_URL: string | null;
  RATE_LIMIT_STRICT_IN_TEST: string | null;
  RATE_LIMIT_ALLOW_MEMORY_FALLBACK: string | null;
  SERVICE_MEDIA_JOB_SECRET: string | null;
  PANEL_HEALTH_SECRET: string | null;
  PANEL_HEALTH_PUBLIC_VISIBILITY: string | null;
  SUPABASE_URL: string | null;
  OPENAI_API_KEY: string | null;
  STRIPE_PRICE_PREMIUM: string | null;
  STRIPE_PRICE_PREMIUM_MONTHLY: string | null;
  RESEND_API_KEY: string | null;
  AUTOMATION_FROM_EMAIL: string | null;
  EMAIL_REMINDER_CRON_SECRET: string | null;
  DATABASE_URL: string | null;
  SEND_EMAIL_HOOK_SECRET: string | null;
  AUTOMATION_REPLY_TO_EMAIL: string | null;
  AUTOMATION_CRON_SECRET: string | null;
  CRON_SECRET: string | null;
}>;

export function validateCriticalEnv() {
  const validation = parseServerEnvValidation();
  if (!validation.success) {
    const issues = validation.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    if (process.env.NODE_ENV === "production") {
      throw new Error(`[server-env] Controlled startup failure. Invalid environment: ${issues}`);
    }

    throw new Error(`[server-env] Development startup crash. Invalid environment: ${issues}`);
  }

  if (process.env.NODE_ENV !== "production") return;

  requireEnv("DATABASE_URL");
  requireEnv("STRIPE_SECRET_KEY");
}

export function validateServerEnvOnStartup() {
  validateCriticalEnv();
}

/**
 * Lazy getters: required secrets throw on FIRST ACCESS if missing.
 * This avoids crashing `next build` page-data collection when env is absent,
 * while still failing loudly at actual request time.
 */
export const ServerEnv: ServerEnvShape = Object.freeze({
  get SUPABASE_SERVICE_ROLE_KEY() { return readRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"); },
  get NEXT_PUBLIC_SUPABASE_URL() { return readRequiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"); },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() { return readRequiredServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"); },
  get STRIPE_SECRET_KEY() { return readRequiredServerEnv("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET() { return readRequiredServerEnv("STRIPE_WEBHOOK_SECRET"); },
  get TURNSTILE_SECRET_KEY() { return readRequiredServerEnv("TURNSTILE_SECRET_KEY"); },
  get NEXT_PUBLIC_TURNSTILE_SITE_KEY() { return readRequiredServerEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY"); },
  get APP_URL() { return readOptionalServerEnv("APP_URL"); },
  get NODE_ENV() { return coerceNodeEnv(); },
  get STRIPE_ALLOW_LIVE_IN_NON_PROD() { return parseBooleanEnv(readOptionalServerEnv("STRIPE_ALLOW_LIVE_IN_NON_PROD")); },
  get AUTH_FORCE_PROFILE_FROM_DB() { return readOptionalServerEnv("AUTH_FORCE_PROFILE_FROM_DB"); },
  get OPENAI_MODEL() { return readOptionalServerEnv("OPENAI_MODEL"); },
  get OPENAI_TRANSCRIBE_MODEL() { return readOptionalServerEnv("OPENAI_TRANSCRIBE_MODEL"); },
  get UPSTASH_REDIS_REST_URL() { return readOptionalServerEnv("UPSTASH_REDIS_REST_URL"); },
  get UPSTASH_REDIS_REST_TOKEN() { return readOptionalServerEnv("UPSTASH_REDIS_REST_TOKEN"); },
  get ADMIN_DASHBOARD_SECRET() { return readOptionalServerEnv("ADMIN_DASHBOARD_SECRET"); },
  get ALERT_WEBHOOK_URL() { return readOptionalServerEnv("ALERT_WEBHOOK_URL"); },
  get RATE_LIMIT_STRICT_IN_TEST() { return readOptionalServerEnv("RATE_LIMIT_STRICT_IN_TEST"); },
  get RATE_LIMIT_ALLOW_MEMORY_FALLBACK() { return readOptionalServerEnv("RATE_LIMIT_ALLOW_MEMORY_FALLBACK"); },
  get SERVICE_MEDIA_JOB_SECRET() { return readOptionalServerEnv("SERVICE_MEDIA_JOB_SECRET"); },
  get PANEL_HEALTH_SECRET() { return readOptionalServerEnv("PANEL_HEALTH_SECRET"); },
  get PANEL_HEALTH_PUBLIC_VISIBILITY() { return readOptionalServerEnv("PANEL_HEALTH_PUBLIC_VISIBILITY"); },
  get SUPABASE_URL() { return readOptionalServerEnv("SUPABASE_URL"); },
  get OPENAI_API_KEY() { return readOptionalServerEnv("OPENAI_API_KEY"); },
  get STRIPE_PRICE_PREMIUM() { return readOptionalServerEnv("STRIPE_PRICE_PREMIUM"); },
  get STRIPE_PRICE_PREMIUM_MONTHLY() { return readOptionalServerEnv("STRIPE_PRICE_PREMIUM_MONTHLY"); },
  get RESEND_API_KEY() { return readOptionalServerEnv("RESEND_API_KEY"); },
  get AUTOMATION_FROM_EMAIL() { return readOptionalServerEnv("AUTOMATION_FROM_EMAIL"); },
  get EMAIL_REMINDER_CRON_SECRET() { return readOptionalServerEnv("EMAIL_REMINDER_CRON_SECRET"); },
  get DATABASE_URL() { return readOptionalServerEnv("DATABASE_URL"); },
  get SEND_EMAIL_HOOK_SECRET() { return readOptionalServerEnv("SEND_EMAIL_HOOK_SECRET"); },
  get AUTOMATION_REPLY_TO_EMAIL() { return readOptionalServerEnv("AUTOMATION_REPLY_TO_EMAIL"); },
  get AUTOMATION_CRON_SECRET() { return readOptionalServerEnv("AUTOMATION_CRON_SECRET"); },
  get CRON_SECRET() { return readOptionalServerEnv("CRON_SECRET"); },
} as ServerEnvShape);

export type ServerEnvType = typeof ServerEnv;
export type ServerEnvKeys = keyof typeof ServerEnv;
