import "server-only";

import fs from "node:fs";
import path from "node:path";

const TURNSTILE_PLACEHOLDER_PATTERNS = [
  "your_turnstile",
  "placeholder",
  "secret_key_here",
  "site_key_here",
] as const;

const TURNSTILE_ROOT_ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");
const TURNSTILE_MISPLACED_ENV_LOCAL_PATH = path.join(process.cwd(), "src", "app", "(admin)", ".env.local");

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

const isDevelopmentEnvironment = () => process.env.NODE_ENV === "development";

export type TurnstileServerEnv = {
  hasMisplacedEnvLocal: boolean;
  missing: string[];
  rootEnvLocalPath: string;
  secretKey: string | null;
  secretKeyLength: number;
  siteKey: string | null;
  siteKeyLength: number;
};

export const readTurnstileServerEnv = (): TurnstileServerEnv => {
  const secretKey = normalizeEnvValue(process.env.TURNSTILE_SECRET_KEY);
  const siteKey = normalizeEnvValue(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const missing: string[] = [];

  if (isPlaceholderValue(secretKey)) {
    missing.push("TURNSTILE_SECRET_KEY");
  }

  if (isPlaceholderValue(siteKey)) {
    missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  }

  return {
    hasMisplacedEnvLocal: fs.existsSync(TURNSTILE_MISPLACED_ENV_LOCAL_PATH),
    missing,
    rootEnvLocalPath: TURNSTILE_ROOT_ENV_LOCAL_PATH,
    secretKey,
    secretKeyLength: secretKey?.length ?? 0,
    siteKey,
    siteKeyLength: siteKey?.length ?? 0,
  };
};

const buildTurnstileEnvErrorMessage = (context: string, env: TurnstileServerEnv) => {
  const segments = [
    `[turnstile.env] Missing required Turnstile env var(s) for ${context}: ${env.missing.join(", ")}.`,
    `Next.js only loads .env.local from the project root: ${env.rootEnvLocalPath}.`,
    "Update the env values and restart the Next.js server.",
  ];

  if (env.hasMisplacedEnvLocal) {
    segments.push(
      `A misplaced env file was found at ${TURNSTILE_MISPLACED_ENV_LOCAL_PATH}. Move those values into ${env.rootEnvLocalPath}.`,
    );
  }

  return segments.join(" ");
};

export const assertTurnstileServerEnv = (context = "server startup") => {
  const env = readTurnstileServerEnv();

  if (env.missing.length > 0) {
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
    rootEnvLocalPath: env.rootEnvLocalPath,
    secretKeyLength: env.secretKeyLength,
    siteKeyLength: env.siteKeyLength,
  });
};
