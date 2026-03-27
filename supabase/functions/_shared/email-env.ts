type RequiredEmailEnvKey =
  | "RESEND_API_KEY"
  | "AUTOMATION_FROM_EMAIL"
  | "APP_URL"
  | "SUPABASE_SERVICE_ROLE_KEY";

type RequiredEmailEnv = Record<RequiredEmailEnvKey, string>;

const placeholderPatterns = [
  /^your[_-]/i,
  /^replace[_-]?me$/i,
  /^changeme$/i,
  /^placeholder$/i,
  /^example/i,
];

const isConfiguredSecret = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return !placeholderPatterns.some((pattern) => pattern.test(normalized));
};

const readRequiredEmailEnv = (key: RequiredEmailEnvKey) => {
  const value = Deno.env.get(key)?.trim() ?? "";
  if (!isConfiguredSecret(value)) {
    throw new Error(`Missing required email env: ${key}`);
  }

  return value;
};

export function requireEmailEnv(): RequiredEmailEnv {
  return {
    RESEND_API_KEY: readRequiredEmailEnv("RESEND_API_KEY"),
    AUTOMATION_FROM_EMAIL: readRequiredEmailEnv("AUTOMATION_FROM_EMAIL"),
    APP_URL: readRequiredEmailEnv("APP_URL"),
    SUPABASE_SERVICE_ROLE_KEY: readRequiredEmailEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
