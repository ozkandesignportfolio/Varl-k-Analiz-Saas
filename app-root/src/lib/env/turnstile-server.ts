import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  isLocalhostTestTurnstileSiteKey,
} from "@/lib/env/turnstile";

const TURNSTILE_PLACEHOLDER_PATTERNS = [
  "your_turnstile",
  "placeholder",
  "secret_key_here",
  "site_key_here",
] as const;

const TURNSTILE_ROOT_ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");
const TURNSTILE_MISPLACED_ENV_LOCAL_PATH = path.join(process.cwd(), "src", "app", "(admin)", ".env.local");
export const TURNSTILE_LOCALHOST_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const normalizeEnvValue = (value: string | undefined) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const isPlaceholderValue = (value: string | null) => {
  const normalizedValue = value?.trim().toLowerCase() ?? "";

  if (!normalizedValue) {
    return true;
  }

  return TURNSTILE_PLACEHOLDER_PATTERNS.some((pattern) => normalizedValue.includes(pattern));
};

const isLocalhostTestTurnstileSecretKey = (secretKey: string | null) =>
  normalizeEnvValue(secretKey ?? undefined) === TURNSTILE_LOCALHOST_TEST_SECRET_KEY;

const isDevelopmentEnvironment = () => process.env.NODE_ENV === "development";
const isProductionEnvironment = () => process.env.NODE_ENV === "production";

type TurnstileKeyKind = "configured" | "localhost_test" | "missing" | "placeholder";

const getTurnstileSecretKeyKind = (secretKey: string | null): TurnstileKeyKind => {
  if (!secretKey) {
    return "missing";
  }

  if (isLocalhostTestTurnstileSecretKey(secretKey)) {
    return "localhost_test";
  }

  if (isPlaceholderValue(secretKey)) {
    return "placeholder";
  }

  return "configured";
};

const getTurnstileSiteKeyKind = (siteKey: string | null): TurnstileKeyKind => {
  if (!siteKey) {
    return "missing";
  }

  if (isLocalhostTestTurnstileSiteKey(siteKey)) {
    return "localhost_test";
  }

  if (isPlaceholderValue(siteKey)) {
    return "placeholder";
  }

  return "configured";
};

export type TurnstileServerEnv = {
  hasMisplacedEnvLocal: boolean;
  missing: string[];
  nodeEnv: string;
  productionUsesTestKeys: boolean;
  rootEnvLocalPath: string;
  secretKey: string | null;
  secretKeyKind: TurnstileKeyKind;
  secretKeyLength: number;
  siteKey: string | null;
  siteKeyKind: TurnstileKeyKind;
  siteKeyLength: number;
  usesLocalDevFallback: boolean;
};

export const readTurnstileServerEnv = (): TurnstileServerEnv => {
  const configuredSecretKey = normalizeEnvValue(process.env.TURNSTILE_SECRET_KEY);
  const configuredSiteKey = normalizeEnvValue(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const secretKeyKind = getTurnstileSecretKeyKind(configuredSecretKey);
  const siteKeyKind = getTurnstileSiteKeyKind(configuredSiteKey);
  const missing: string[] = [];

  if (secretKeyKind !== "configured") {
    missing.push("TURNSTILE_SECRET_KEY");
  }

  if (siteKeyKind !== "configured") {
    missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  }

  const usesLocalDevFallback = isDevelopmentEnvironment() && missing.length > 0;
  const secretKey = configuredSecretKey;
  const siteKey = configuredSiteKey;
  const productionUsesTestKeys =
    isProductionEnvironment() &&
    (secretKeyKind === "localhost_test" || siteKeyKind === "localhost_test");

  return {
    hasMisplacedEnvLocal: fs.existsSync(TURNSTILE_MISPLACED_ENV_LOCAL_PATH),
    missing,
    nodeEnv: process.env.NODE_ENV ?? "undefined",
    productionUsesTestKeys,
    rootEnvLocalPath: TURNSTILE_ROOT_ENV_LOCAL_PATH,
    secretKey,
    secretKeyKind,
    secretKeyLength: secretKey?.length ?? 0,
    siteKey,
    siteKeyKind,
    siteKeyLength: siteKey?.length ?? 0,
    usesLocalDevFallback,
  };
};

const buildTurnstileEnvErrorMessage = (context: string, env: TurnstileServerEnv) => {
  const segments = [
    `[turnstile.env] Missing or invalid Turnstile env var(s) for ${context}: ${env.missing.join(", ")}.`,
    `Next.js only loads .env.local from the project root: ${env.rootEnvLocalPath}.`,
    "Cloudflare localhost test keys are allowed only for localhost requests in development.",
    "Update the env values and restart the Next.js server.",
  ];

  if (env.productionUsesTestKeys) {
    segments.push(
      `NODE_ENV=production iken Cloudflare test key kullanilamaz. siteKeyKind=${env.siteKeyKind}, secretKeyKind=${env.secretKeyKind}.`,
    );
  }

  if (env.hasMisplacedEnvLocal) {
    segments.push(
      `A misplaced env file was found at ${TURNSTILE_MISPLACED_ENV_LOCAL_PATH}. Move those values into ${env.rootEnvLocalPath}.`,
    );
  }

  return segments.join(" ");
};

export const assertTurnstileServerEnv = (context = "server startup") => {
  const env = readTurnstileServerEnv();

  if (env.missing.length > 0 && !env.usesLocalDevFallback) {
    throw new Error(buildTurnstileEnvErrorMessage(context, env));
  }

  return env;
};

export const logTurnstileEnvDebug = (context: string) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const env = readTurnstileServerEnv();

  console.info("[turnstile.env] Server env debug.", {
    context,
    hasMisplacedEnvLocal: env.hasMisplacedEnvLocal,
    missing: env.missing,
    nodeEnv: env.nodeEnv,
    productionUsesTestKeys: env.productionUsesTestKeys,
    rootEnvLocalPath: env.rootEnvLocalPath,
    secretKeyKind: env.secretKeyKind,
    secretKeyLength: env.secretKeyLength,
    siteKeyKind: env.siteKeyKind,
    siteKeyLength: env.siteKeyLength,
    usesLocalDevFallback: env.usesLocalDevFallback,
  });
};
