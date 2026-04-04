/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const TURNSTILE_PLACEHOLDER_PATTERNS = [
  "your_turnstile",
  "placeholder",
  "secret_key_here",
  "site_key_here",
];
const TURNSTILE_LOCALHOST_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_LOCALHOST_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

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

const isLocalhostTestTurnstileSiteKey = (value) =>
  normalizeEnvValue(value) === TURNSTILE_LOCALHOST_TEST_SITE_KEY;

const isLocalhostTestTurnstileSecretKey = (value) =>
  normalizeEnvValue(value) === TURNSTILE_LOCALHOST_TEST_SECRET_KEY;

const getTurnstileSecretKeyKind = (value) => {
  const normalizedValue = normalizeEnvValue(value);

  if (!normalizedValue) {
    return "missing";
  }

  if (isLocalhostTestTurnstileSecretKey(normalizedValue)) {
    return "localhost_test";
  }

  if (isPlaceholderValue(normalizedValue)) {
    return "placeholder";
  }

  return "configured";
};

const getTurnstileSiteKeyKind = (value) => {
  const normalizedValue = normalizeEnvValue(value);

  if (!normalizedValue) {
    return "missing";
  }

  if (isLocalhostTestTurnstileSiteKey(normalizedValue)) {
    return "localhost_test";
  }

  if (isPlaceholderValue(normalizedValue)) {
    return "placeholder";
  }

  return "configured";
};

const getTurnstileEnvSummary = () => {
  const projectRoot = process.cwd();
  const rootEnvLocalPath = path.join(projectRoot, ".env.local");
  const misplacedEnvLocalPath = path.join(projectRoot, "src", "app", "(admin)", ".env.local");
  const secretKey = normalizeEnvValue(process.env.TURNSTILE_SECRET_KEY);
  const siteKey = normalizeEnvValue(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const secretKeyKind = getTurnstileSecretKeyKind(secretKey);
  const siteKeyKind = getTurnstileSiteKeyKind(siteKey);
  const missing = [];

  if (secretKeyKind !== "configured") {
    missing.push("TURNSTILE_SECRET_KEY");
  }

  if (siteKeyKind !== "configured") {
    missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  }

  return {
    hasMisplacedEnvLocal: fs.existsSync(misplacedEnvLocalPath),
    missing,
    nodeEnv: process.env.NODE_ENV ?? "undefined",
    misplacedEnvLocalPath,
    productionUsesTestKeys:
      process.env.NODE_ENV === "production" &&
      (secretKeyKind === "localhost_test" || siteKeyKind === "localhost_test"),
    rootEnvLocalPath,
    secretKeyKind,
    secretKeyLength: secretKey?.length ?? 0,
    siteKeyKind,
    siteKeyLength: siteKey?.length ?? 0,
  };
};

const buildTurnstileEnvError = (summary, context) => {
  const details = [
    `[turnstile.env] Missing or invalid Turnstile env var(s) for ${context}: ${summary.missing.join(", ")}.`,
    `Next.js only loads .env.local from the project root: ${summary.rootEnvLocalPath}.`,
    "Cloudflare localhost test keys are allowed only for localhost requests in development.",
    "Update the env values and restart the Next.js server.",
  ];

  if (summary.productionUsesTestKeys) {
    details.push(
      `NODE_ENV=production iken Cloudflare test key kullanilamaz. siteKeyKind=${summary.siteKeyKind}, secretKeyKind=${summary.secretKeyKind}.`,
    );
  }

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
      nodeEnv: summary.nodeEnv,
      productionUsesTestKeys: summary.productionUsesTestKeys,
      rootEnvLocalPath: summary.rootEnvLocalPath,
      secretKeyKind: summary.secretKeyKind,
      secretKeyLength: summary.secretKeyLength,
      siteKeyKind: summary.siteKeyKind,
      siteKeyLength: summary.siteKeyLength,
    });
  }

  if (summary.missing.length > 0 && process.env.NODE_ENV === "development") {
    console.warn("[turnstile.env] Missing env vars detected in development. Falling back to Cloudflare test keys for localhost.");
    return summary;
  }

  if (summary.missing.length > 0) {
    throw buildTurnstileEnvError(summary, context);
  }

  return summary;
};

module.exports = {
  validateTurnstileEnv,
};
