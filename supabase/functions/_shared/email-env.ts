type RequiredEmailEnvKey =
  | "RESEND_API_KEY"
  | "AUTOMATION_FROM_EMAIL"
  | "APP_URL"
  | "SUPABASE_SERVICE_ROLE_KEY";

type RequiredEmailEnv = Record<RequiredEmailEnvKey, string>;
type EmailEnvState = {
  values: Partial<RequiredEmailEnv>;
  missingEnv: string[];
  appUrlSource: "APP_URL" | "NEXT_PUBLIC_APP_URL" | null;
};

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

export function getEmailEnvState(): EmailEnvState {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromEmail = Deno.env.get("AUTOMATION_FROM_EMAIL")?.trim() ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const appUrl = Deno.env.get("APP_URL")?.trim() ?? "";
  const publicAppUrl = Deno.env.get("NEXT_PUBLIC_APP_URL")?.trim() ?? "";
  const normalizedAppUrl = isConfiguredSecret(appUrl) ? appUrl : isConfiguredSecret(publicAppUrl) ? publicAppUrl : "";
  const appUrlSource = isConfiguredSecret(appUrl)
    ? "APP_URL"
    : isConfiguredSecret(publicAppUrl)
      ? "NEXT_PUBLIC_APP_URL"
      : null;
  const missingEnv: string[] = [];

  if (!isConfiguredSecret(resendApiKey)) {
    missingEnv.push("RESEND_API_KEY");
  }

  if (!isConfiguredSecret(fromEmail)) {
    missingEnv.push("AUTOMATION_FROM_EMAIL");
  }

  if (!isConfiguredSecret(normalizedAppUrl)) {
    missingEnv.push("APP_URL|NEXT_PUBLIC_APP_URL");
  }

  if (!isConfiguredSecret(serviceRoleKey)) {
    missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    values: {
      RESEND_API_KEY: resendApiKey,
      AUTOMATION_FROM_EMAIL: fromEmail,
      APP_URL: normalizedAppUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    },
    missingEnv,
    appUrlSource,
  };
}

export function requireEmailEnv(): RequiredEmailEnv {
  const state = getEmailEnvState();

  if (state.missingEnv.length > 0) {
    throw new Error(`Missing required email env: ${state.missingEnv.join(", ")}`);
  }

  return {
    RESEND_API_KEY: state.values.RESEND_API_KEY ?? readRequiredEmailEnv("RESEND_API_KEY"),
    AUTOMATION_FROM_EMAIL: state.values.AUTOMATION_FROM_EMAIL ?? readRequiredEmailEnv("AUTOMATION_FROM_EMAIL"),
    APP_URL: state.values.APP_URL ?? readRequiredEmailEnv("APP_URL"),
    SUPABASE_SERVICE_ROLE_KEY:
      state.values.SUPABASE_SERVICE_ROLE_KEY ?? readRequiredEmailEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
