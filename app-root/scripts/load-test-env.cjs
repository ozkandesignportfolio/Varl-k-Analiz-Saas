/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require("node:fs");

const DEFAULT_ENV_FILES = [".env.test", ".env.local", ".env"];

const parseEnv = (text) => {
  const out = {};
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    if (!key) {
      continue;
    }

    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    out[key] = value.replace(/\\n/g, "\n");
  }

  return out;
};

const getExplicitEnvFiles = () => {
  const explicit = String(process.env.TEST_ENV_FILE || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return explicit;
};

const MISSING_ENV_STRINGS = new Set(["", "undefined", "null"]);

const unquote = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const startsWithDouble = trimmed.startsWith('"') && trimmed.endsWith('"');
  const startsWithSingle = trimmed.startsWith("'") && trimmed.endsWith("'");
  if (!startsWithDouble && !startsWithSingle) {
    return trimmed;
  }

  return trimmed.slice(1, -1).trim();
};

const isMissingEnvValue = (value) => {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (MISSING_ENV_STRINGS.has(trimmed)) {
    return true;
  }

  return MISSING_ENV_STRINGS.has(unquote(trimmed));
};

const merge = (existing, fallback) => {
  if (!isMissingEnvValue(existing)) {
    return existing;
  }
  if (isMissingEnvValue(fallback)) {
    return undefined;
  }
  return fallback;
};

const setIfEmpty = (env, key, value) => {
  if (!env || typeof env !== "object") {
    return;
  }

  if (isMissingEnvValue(value)) {
    if (Object.prototype.hasOwnProperty.call(env, key) && isMissingEnvValue(env[key])) {
      delete env[key];
    }
    return;
  }

  const nextValue = merge(env[key], value);
  if (isMissingEnvValue(nextValue)) {
    if (Object.prototype.hasOwnProperty.call(env, key) && isMissingEnvValue(env[key])) {
      delete env[key];
    }
    return;
  }

  env[key] = nextValue;
};

const CANONICAL_ENV_ALIASES = [
  ["E2E_EMAIL", ["E2E_EMAIL", "PREMIUM_EMAIL", "TRIAL_EMAIL"]],
  ["E2E_PASSWORD", ["E2E_PASSWORD", "PREMIUM_PASSWORD", "TRIAL_PASSWORD"]],
  ["TRIAL_LOGIN_EMAIL", ["TRIAL_LOGIN_EMAIL", "TRIAL_EMAIL", "TEST_LOGIN_EMAIL"]],
  ["TRIAL_LOGIN_PASSWORD", ["TRIAL_LOGIN_PASSWORD", "TRIAL_PASSWORD", "TEST_LOGIN_PASSWORD"]],
  ["PREMIUM_LOGIN_EMAIL", ["PREMIUM_LOGIN_EMAIL", "PREMIUM_EMAIL", "TEST_ALT_LOGIN_EMAIL"]],
  ["PREMIUM_LOGIN_PASSWORD", ["PREMIUM_LOGIN_PASSWORD", "PREMIUM_PASSWORD", "TEST_ALT_LOGIN_PASSWORD"]],
];

const applyCanonicalAliases = (env = process.env) => {
  for (const [targetKey, candidates] of CANONICAL_ENV_ALIASES) {
    const resolved = firstDefinedEnv(candidates, env);
    if (isMissingEnvValue(resolved.value)) {
      continue;
    }
    setIfEmpty(env, targetKey, resolved.value);
  }
};

const loadTestEnv = ({ env = process.env, envFiles = DEFAULT_ENV_FILES } = {}) => {
  const candidatePaths = [...getExplicitEnvFiles(), ...envFiles];
  const seen = new Set();

  for (const filePath of candidatePaths) {
    if (seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);

    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnv(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (value == null) {
        continue;
      }
      setIfEmpty(env, key, value);
    }
  }

  applyCanonicalAliases(env);
  return env;
};

const firstDefinedEnv = (names, env = process.env) => {
  for (const name of names) {
    if (typeof name !== "string") {
      continue;
    }

    const value = env[name];
    if (isMissingEnvValue(value)) {
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (isMissingEnvValue(trimmed)) {
      continue;
    }

    return { name, value: trimmed };
  }

  return { name: null, value: null };
};

const REQUIRED_ENV = {
  criticalFlow: [
    { key: "E2E_EMAIL", aliases: ["PREMIUM_EMAIL", "TRIAL_EMAIL"] },
    { key: "E2E_PASSWORD", aliases: ["PREMIUM_PASSWORD", "TRIAL_PASSWORD"] },
  ],
  rls: [
    { key: "NEXT_PUBLIC_SUPABASE_URL" },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY" },
    { key: "SUPABASE_SERVICE_ROLE_KEY" },
  ],
  stable: {
    trial: [
      { key: "TRIAL_LOGIN_EMAIL", aliases: ["TRIAL_EMAIL", "TEST_LOGIN_EMAIL"] },
      { key: "TRIAL_LOGIN_PASSWORD", aliases: ["TRIAL_PASSWORD", "TEST_LOGIN_PASSWORD"] },
    ],
    premium: [
      { key: "PREMIUM_LOGIN_EMAIL", aliases: ["PREMIUM_EMAIL", "TEST_ALT_LOGIN_EMAIL"] },
      { key: "PREMIUM_LOGIN_PASSWORD", aliases: ["PREMIUM_PASSWORD", "TEST_ALT_LOGIN_PASSWORD"] },
    ],
  },
};

const getSuiteRequirements = (suite, options = {}) => {
  const target = String(options.target || "both").toLowerCase();

  if (suite === "criticalFlow" || suite === "criticalflow" || suite === "critical") {
    return REQUIRED_ENV.criticalFlow;
  }

  if (suite === "rls") {
    return REQUIRED_ENV.rls;
  }

  if (suite === "stable") {
    if (target === "trial") return REQUIRED_ENV.stable.trial;
    if (target === "premium") return REQUIRED_ENV.stable.premium;
    if (target === "both") return [...REQUIRED_ENV.stable.trial, ...REQUIRED_ENV.stable.premium];
    throw new Error(`Invalid stable target: ${target}. Expected: trial | premium | both.`);
  }

  throw new Error(`Unknown env suite: ${suite}.`);
};

const getSuiteEnvValues = (suite, options = {}) => {
  const requirements = getSuiteRequirements(suite, options);
  const missing = [];
  const values = Object.create(null);
  const sources = Object.create(null);
  const env = options.env || process.env;

  for (const req of requirements) {
    const { name, value } = firstDefinedEnv([req.key, ...(req.aliases || [])], env);
    if (!name || value == null) {
      missing.push({
        key: req.key,
        candidates: [req.key, ...(req.aliases || [])],
      });
      continue;
    }

    values[req.key] = value;
    sources[req.key] = name;
  }

  return { values, sources, missing };
};

const suiteDisplayName = {
  criticalFlow: "critical flow",
  criticalflow: "critical flow",
  critical: "critical flow",
  rls: "RLS",
  stable: "stable",
};

const validateRequiredSuiteEnv = (suite, options = {}) => {
  const result = getSuiteEnvValues(suite, options);
  if (result.missing.length === 0) {
    const env = options.env || process.env;
    for (const [key, value] of Object.entries(result.values)) {
      setIfEmpty(env, key, value);
    }
    return result;
  }

  const suiteName = suiteDisplayName[suite] || suite;
  const lines = [
    `Missing required env vars for ${suiteName} suite.`,
    ...result.missing.map((entry) => `- ${entry.key}: set one of [${entry.candidates.join(" / ")}]`),
    "Load order: existing process.env -> .env.test -> .env.local -> .env",
    "Tip: ensure keys exist in one of .env.test, .env.local, .env or current process.env.",
  ];

  throw new Error(lines.join("\n"));
};

module.exports = {
  loadTestEnv,
  firstDefinedEnv,
  getSuiteEnvValues,
  validateRequiredSuiteEnv,
};
