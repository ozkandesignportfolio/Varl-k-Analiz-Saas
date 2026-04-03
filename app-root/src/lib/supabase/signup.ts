export const SIGNUP_COOLDOWN_STORAGE_KEY = "signup_cooldown_end_timestamp";
export const SIGNUP_COOLDOWN_MS = 60_000;
export const EMAIL_ALREADY_EXISTS_ERROR = "EMAIL_ALREADY_EXISTS";
export const EMAIL_RATE_LIMITED_ERROR = "EMAIL_RATE_LIMITED";
export const EMAIL_CONFIRMATION_DISABLED_ERROR = "EMAIL_CONFIRMATION_DISABLED";
export const SIGNUP_FAILED_ERROR = "SIGNUP_FAILED";

export const getSignupCooldownRemainingSeconds = (cooldownEndTimestamp: number, now = Date.now()) => {
  const remainingMs = cooldownEndTimestamp - now;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1_000) : 0;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
