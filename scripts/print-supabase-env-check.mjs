import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) dotenv.config({ path: '.env.local' });
if (existsSync('.env')) dotenv.config({ path: '.env' });
const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const PLACEHOLDER_TOKENS = [
  "<project>",
  "<project-ref>",
  "<anon-key>",
  "<service-role-key>",
  "your_url_here",
  "your_anon_key_here",
  "your_service_role_here",
  "your_project_ref",
  "your_supabase_anon_key",
  "your_supabase_service_role_key",
  "changeme",
  "replace_me",
  "placeholder",
];

const readEnv = (key) => (process.env[key] ?? "").trim();

const looksLikePlaceholder = (value) => {
  const lower = value.toLowerCase();
  return PLACEHOLDER_TOKENS.some((token) => lower.includes(token));
};

const maskPrefix = (value, count = 4) => {
  if (!value) {
    return "n/a";
  }
  const shown = value.slice(0, Math.min(count, value.length));
  return `${shown}...`;
};

const validateUrl = (value) => {
  if (!value) {
    return { valid: false, reason: "missing", detail: "len=0 protocol=n/a absolute=no supabaseHost=n/a" };
  }
  if (looksLikePlaceholder(value)) {
    return {
      valid: false,
      reason: "placeholder",
      detail: `len=${value.length} protocol=n/a absolute=no supabaseHost=n/a`,
    };
  }

  try {
    const parsed = new URL(value);
    const protocolOk = parsed.protocol === "http:" || parsed.protocol === "https:";
    const absolute = Boolean(parsed.hostname);
    const supabaseHost = parsed.hostname.endsWith(".supabase.co");
    const valid = protocolOk && absolute;
    return {
      valid,
      reason: valid ? null : "malformed-url",
      detail: `len=${value.length} protocol=${parsed.protocol} absolute=${absolute ? "yes" : "no"} supabaseHost=${
        supabaseHost ? "yes" : "no"
      }`,
    };
  } catch {
    return {
      valid: false,
      reason: "malformed-url",
      detail: `len=${value.length} protocol=n/a absolute=no supabaseHost=n/a`,
    };
  }
};

const validateKey = (value, label) => {
  if (!value) {
    return {
      valid: false,
      reason: "missing",
      detail: "len=0 prefix=n/a prefixOk=no",
    };
  }
  if (looksLikePlaceholder(value)) {
    return {
      valid: false,
      reason: "placeholder",
      detail: `len=${value.length} prefix=${maskPrefix(value)} prefixOk=no`,
    };
  }

  const prefix = maskPrefix(value);
  const isJwtLike = value.startsWith("eyJ");
  const isPublishable = value.startsWith("sb_publishable_");
  const isSecret = value.startsWith("sb_secret_");

  const prefixOk =
    label === "anon"
      ? isJwtLike || isPublishable
      : isJwtLike || isSecret;

  return {
    valid: true,
    reason: null,
    detail: `len=${value.length} prefix=${prefix} prefixOk=${prefixOk ? "yes" : "no"}`,
  };
};

const urlValue = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonValue = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceValue = readEnv("SUPABASE_SERVICE_ROLE_KEY");

const results = {
  NEXT_PUBLIC_SUPABASE_URL: validateUrl(urlValue),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: validateKey(anonValue, "anon"),
  SUPABASE_SERVICE_ROLE_KEY: validateKey(serviceValue, "service"),
};

console.log("Supabase env preflight check");
console.log("----------------------------------------");
for (const key of REQUIRED_ENV_KEYS) {
  const result = results[key];
  const status = result.valid ? "OK" : "INVALID";
  console.log(`${key}: ${status} (${result.detail})`);
}

const failures = REQUIRED_ENV_KEYS.filter((key) => !results[key].valid);
if (failures.length > 0) {
  console.error("");
  console.error("Action required:");
  for (const key of failures) {
    console.error(`- ${key}: ${results[key].reason}`);
  }
  console.error("Get values from Supabase Dashboard > Project Settings > API (or Data API):");
  console.error("- Project URL -> NEXT_PUBLIC_SUPABASE_URL");
  console.error("- anon/public key -> NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("- service_role/secret key -> SUPABASE_SERVICE_ROLE_KEY");
  console.error("PowerShell (current session):");
  console.error("$env:NEXT_PUBLIC_SUPABASE_URL='https://<project-ref>.supabase.co'");
  console.error("$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='<anon-key>'");
  console.error("$env:SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'");
  process.exit(1);
}

console.log("");
console.log("All required Supabase env vars look valid.");


