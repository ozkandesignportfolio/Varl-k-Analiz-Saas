import { BuildEnv, isDevelopmentNodeEnv } from "@/lib/env/build-env";
import { Runtime } from "@/lib/env/runtime";

const BUILD_TIME_FALLBACK = "http://localhost:3000";

type PublicEnvKey =
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  | "NEXT_PUBLIC_PLAN_DEBUG"
  | "NEXT_PUBLIC_ENABLE_NOTIFICATION_MOCK_FALLBACK"
  | "NEXT_PUBLIC_SHOW_LANDING_DEBUG_BADGE"
  | "NEXT_PUBLIC_DEMO_VIDEO_URL"
  | "NEXT_PUBLIC_SENTRY_DSN"
  | "NEXT_PUBLIC_SENTRY_ENABLED"
  | "NEXT_PUBLIC_SENTRY_ENVIRONMENT"
  | "NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE"
  | "NEXT_PUBLIC_FEATURE_PREMIUM_MEDIA_DEFAULT"
  | "NEXT_PUBLIC_AUTH_FORCE_PROFILE_FROM_DB";

const readPublicEnv = (key: PublicEnvKey): string => {
  if (typeof process === "undefined") {
    return "";
  }

  const raw = process.env[key];
  if (typeof raw !== "string") {
    return "";
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : "";
};

export const PublicEnv = Object.freeze({
  NEXT_PUBLIC_APP_URL: readPublicEnv("NEXT_PUBLIC_APP_URL"),
  NEXT_PUBLIC_SUPABASE_URL: readPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: readPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: readPublicEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
  NEXT_PUBLIC_PLAN_DEBUG: readPublicEnv("NEXT_PUBLIC_PLAN_DEBUG"),
  NEXT_PUBLIC_ENABLE_NOTIFICATION_MOCK_FALLBACK: readPublicEnv("NEXT_PUBLIC_ENABLE_NOTIFICATION_MOCK_FALLBACK"),
  NEXT_PUBLIC_SHOW_LANDING_DEBUG_BADGE: readPublicEnv("NEXT_PUBLIC_SHOW_LANDING_DEBUG_BADGE"),
  NEXT_PUBLIC_DEMO_VIDEO_URL: readPublicEnv("NEXT_PUBLIC_DEMO_VIDEO_URL"),
  NEXT_PUBLIC_SENTRY_DSN: readPublicEnv("NEXT_PUBLIC_SENTRY_DSN"),
  NEXT_PUBLIC_SENTRY_ENABLED: readPublicEnv("NEXT_PUBLIC_SENTRY_ENABLED"),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: readPublicEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT"),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: readPublicEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE"),
  NEXT_PUBLIC_FEATURE_PREMIUM_MEDIA_DEFAULT: readPublicEnv("NEXT_PUBLIC_FEATURE_PREMIUM_MEDIA_DEFAULT"),
  NEXT_PUBLIC_AUTH_FORCE_PROFILE_FROM_DB: readPublicEnv("NEXT_PUBLIC_AUTH_FORCE_PROFILE_FROM_DB"),
});

export type PublicEnvKeys = keyof typeof PublicEnv;

const isBuildPhase = (): boolean => Runtime.isBuild();

const normalizeOrigin = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
};

const readConfiguredOrigin = (): string | null => {
  return normalizeOrigin(PublicEnv.NEXT_PUBLIC_APP_URL);
};

let hasLoggedDevWarning = false;

const warnIfDev = (reason: string) => {
  if (!isDevelopmentNodeEnv() && BuildEnv.NODE_ENV !== "") return;
  if (hasLoggedDevWarning) return;
  hasLoggedDevWarning = true;
  console.warn(
    `[Assetly] NEXT_PUBLIC_APP_URL not set (${reason}). Falling back to ${BUILD_TIME_FALLBACK}. Configure in .env.local for local dev or Vercel for preview/production.`,
  );
};

export const getAppUrl = (): string => {
  if (Runtime.isClient()) {
    return window.location.origin;
  }

  const configured = readConfiguredOrigin();
  if (configured) return configured;

  warnIfDev(isBuildPhase() ? "build/prerender" : "server runtime");
  return BUILD_TIME_FALLBACK;
};

export const requireAppUrl = (): string => {
  if (Runtime.isClient()) {
    return window.location.origin;
  }

  const configured = readConfiguredOrigin();
  if (configured) return configured;

  if (isBuildPhase()) {
    warnIfDev("build/prerender");
    return BUILD_TIME_FALLBACK;
  }

  throw new Error(
    "NEXT_PUBLIC_APP_URL is required. Set it in .env.local (local) or Vercel project environment variables (preview/production).",
  );
};

export const getAllowedAppOrigins = (): string[] => {
  const origins = new Set<string>();
  const publicOrigin = normalizeOrigin(PublicEnv.NEXT_PUBLIC_APP_URL);
  if (publicOrigin) origins.add(publicOrigin);
  return Array.from(origins);
};
