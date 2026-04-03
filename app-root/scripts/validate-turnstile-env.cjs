/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const TURNSTILE_PLACEHOLDER_PATTERNS = [
  "your_turnstile",
  "placeholder",
  "secret_key_here",
  "site_key_here",
];

const normalizeEnvValue = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
};

const isPlaceholderValue = (value) => {
  const normalizedValue = normalizeEnvValue(value)?.toLowerCase();

  if (!normalizedValue) {
    return true;
  }

  return TURNSTILE_PLACEHOLDER_PATTERNS.some((pattern) => normalizedValue.includes(pattern));
};

const getTurnstileEnvSummary = () => {
  const projectRoot = process.cwd();
  const rootEnvLocalPath = path.join(projectRoot, ".env.local");
  const misplacedEnvLocalPath = path.join(projectRoot, "src", "app", "(admin)", ".env.local");
  const secretKey = normalizeEnvValue(process.env.TURNSTILE_SECRET_KEY);
  const siteKey = normalizeEnvValue(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const missing = [];

  if (isPlaceholderValue(secretKey)) {
    missing.push("TURNSTILE_SECRET_KEY");
  }

  if (isPlaceholderValue(siteKey)) {
    missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  }

  return {
    hasMisplacedEnvLocal: fs.existsSync(misplacedEnvLocalPath),
    missing,
    misplacedEnvLocalPath,
    rootEnvLocalPath,
    secretKeyLength: secretKey?.length ?? 0,
    siteKeyLength: siteKey?.length ?? 0,
  };
};

const buildTurnstileEnvError = (summary, context) => {
  const details = [
    `[turnstile.env] Missing required Turnstile env var(s) for ${context}: ${summary.missing.join(", ")}.`,
    `Next.js only loads .env.local from the project root: ${summary.rootEnvLocalPath}.`,
    "Update the env values and restart the Next.js server.",
  ];

  if (summary.hasMisplacedEnvLocal) {
    details.push(
      `A misplaced env file was found at ${summary.misplacedEnvLocalPath}. Move those values into ${summary.rootEnvLocalPath}.`,
    );
  }

  return new Error(details.join(" "));
};

const validateTurnstileEnv = (context = "startup") => {
  const summary = getTurnstileEnvSummary();

  if (process.env.NODE_ENV === "development") {
    console.info("[turnstile.env] Startup validation summary.", {
      context,
      hasMisplacedEnvLocal: summary.hasMisplacedEnvLocal,
      missing: summary.missing,
      rootEnvLocalPath: summary.rootEnvLocalPath,
      secretKeyLength: summary.secretKeyLength,
      siteKeyLength: summary.siteKeyLength,
    });
  }

  if (summary.missing.length > 0) {
    throw buildTurnstileEnvError(summary, context);
  }

  return summary;
};

module.exports = {
  validateTurnstileEnv,
};
