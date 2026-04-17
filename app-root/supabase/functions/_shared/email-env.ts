// Invalid domains that should be rejected
export const INVALID_EMAIL_DOMAINS = ["resend.dev", "example.com", "test.com", "localhost"];

type RequiredEmailEnvKey =
  | "RESEND_API_KEY"
  | "AUTOMATION_FROM_EMAIL"
  | "APP_URL"
  | "SUPABASE_SERVICE_ROLE_KEY";

type RequiredEmailEnv = Record<RequiredEmailEnvKey, string>;
type EmailEnvState = {
  values: Partial<RequiredEmailEnv>;
  missingEnv: string[];
  invalidEnv: string[];
  appUrlSource: "APP_URL" | "NEXT_PUBLIC_APP_URL" | null;
};

const placeholderPatterns = [
  /^your[_-]/i,
  /^replace[_-]?me$/i,
  /^changeme$/i,
  /^placeholder$/i,
  /^example/i,
  /^xxx/i,
  /^re_xxx/i,
];

const isConfiguredSecret = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return !placeholderPatterns.some((pattern) => pattern.test(normalized));
};

/**
 * Validate email format and domain
 * Returns validation result with reason if invalid
 */
export function validateEmailSender(email: string): { valid: boolean; reason?: string } {
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: "invalid_email_format" };
  }

  // Extract domain
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return { valid: false, reason: "missing_domain" };
  }

  // Check for invalid domains
  for (const invalidDomain of INVALID_EMAIL_DOMAINS) {
    if (domain.includes(invalidDomain)) {
      return { valid: false, reason: `invalid_domain_${invalidDomain}` };
    }
  }

  // Check for unverified patterns (domains that are commonly not verified)
  if (domain.includes("gmail.com") || domain.includes("yahoo.com") || domain.includes("hotmail.com")) {
    return { valid: false, reason: "unverified_domain_public_email" };
  }

  return { valid: true };
}

/**
 * Log email environment validation error
 */
function logEmailEnvError(context: string, details: Record<string, unknown>) {
  console.error(JSON.stringify({
    event: "EMAIL_ENV_VALIDATION_ERROR",
    context,
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

const readRequiredEmailEnv = (key: RequiredEmailEnvKey) => {
  const value = Deno.env.get(key)?.trim() ?? "";
  if (!isConfiguredSecret(value)) {
    logEmailEnvError("read_required", { key, available: !!value });
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
  const invalidEnv: string[] = [];

  if (!isConfiguredSecret(resendApiKey)) {
    missingEnv.push("RESEND_API_KEY");
  }

  if (!isConfiguredSecret(fromEmail)) {
    missingEnv.push("AUTOMATION_FROM_EMAIL");
  } else {
    // Validate email sender domain
    const emailValidation = validateEmailSender(fromEmail);
    if (!emailValidation.valid) {
      invalidEnv.push(`AUTOMATION_FROM_EMAIL (${emailValidation.reason})`);
      logEmailEnvError("invalid_from_email", {
        fromEmail,
        reason: emailValidation.reason,
      });
    }
  }

  if (!isConfiguredSecret(normalizedAppUrl)) {
    missingEnv.push("APP_URL|NEXT_PUBLIC_APP_URL");
  }

  if (!isConfiguredSecret(serviceRoleKey)) {
    missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  // Log validation results
  if (missingEnv.length > 0 || invalidEnv.length > 0) {
    logEmailEnvError("get_email_env_state", {
      missingEnv,
      invalidEnv,
      fromEmailConfigured: isConfiguredSecret(fromEmail),
      resendKeyConfigured: isConfiguredSecret(resendApiKey),
    });
  }

  return {
    values: {
      RESEND_API_KEY: resendApiKey,
      AUTOMATION_FROM_EMAIL: fromEmail,
      APP_URL: normalizedAppUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    },
    missingEnv,
    invalidEnv,
    appUrlSource,
  };
}

export function requireEmailEnv(): RequiredEmailEnv {
  const state = getEmailEnvState();

  // Check for missing env vars
  if (state.missingEnv.length > 0) {
    logEmailEnvError("require_email_env_missing", {
      missing: state.missingEnv,
    });
    throw new Error(`Missing required email env: ${state.missingEnv.join(", ")}`);
  }

  // Check for invalid env vars (e.g., invalid from email domain)
  if (state.invalidEnv.length > 0) {
    logEmailEnvError("require_email_env_invalid", {
      invalid: state.invalidEnv,
    });
    throw new Error(`Invalid email env configuration: ${state.invalidEnv.join(", ")}`);
  }

  return {
    RESEND_API_KEY: state.values.RESEND_API_KEY ?? readRequiredEmailEnv("RESEND_API_KEY"),
    AUTOMATION_FROM_EMAIL: state.values.AUTOMATION_FROM_EMAIL ?? readRequiredEmailEnv("AUTOMATION_FROM_EMAIL"),
    APP_URL: state.values.APP_URL ?? readRequiredEmailEnv("APP_URL"),
    SUPABASE_SERVICE_ROLE_KEY:
      state.values.SUPABASE_SERVICE_ROLE_KEY ?? readRequiredEmailEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
