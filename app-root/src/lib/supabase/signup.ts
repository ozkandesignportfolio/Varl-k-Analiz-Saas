export const SIGNUP_COOLDOWN_STORAGE_KEY = "signup_cooldown_end_timestamp";
export const SIGNUP_COOLDOWN_MS = 60_000;
export const EMAIL_ALREADY_EXISTS_ERROR = "EMAIL_ALREADY_EXISTS";
export const EMAIL_RATE_LIMITED_ERROR = "EMAIL_RATE_LIMITED";
export const RATE_LIMITED_ERROR = "RATE_LIMITED";
export const INVALID_EMAIL_ERROR = "INVALID_EMAIL";
export const INVALID_PASSWORD_ERROR = "INVALID_PASSWORD";
export const INVALID_REDIRECT_URL_ERROR = "INVALID_REDIRECT_URL";
export const TERMS_NOT_ACCEPTED_ERROR = "TERMS_NOT_ACCEPTED";
export const PRIVACY_POLICY_NOT_ACCEPTED_ERROR = "PRIVACY_POLICY_NOT_ACCEPTED";
export const KVKK_CONSENT_REQUIRED_ERROR = "KVKK_CONSENT_REQUIRED";
export const TURNSTILE_REQUIRED_ERROR = "TURNSTILE_REQUIRED";
export const TURNSTILE_INVALID_ERROR = "TURNSTILE_INVALID";
export const TURNSTILE_UNAVAILABLE_ERROR = "TURNSTILE_UNAVAILABLE";
export const RATE_LIMITER_UNAVAILABLE_ERROR = "RATE_LIMITER_UNAVAILABLE";
export const EMAIL_CONFIRMATION_DISABLED_ERROR = "EMAIL_CONFIRMATION_DISABLED";
export const SIGNUP_FAILED_ERROR = "SIGNUP_FAILED";
export const BOT_DETECTED_ERROR = TURNSTILE_INVALID_ERROR;

export type SignupRiskLevel = "low" | "medium" | "high" | "critical";

export type SignupRisk = {
  level: SignupRiskLevel;
  reasons: string[];
  score: number;
  signals: {
    deviceAttemptsLast10m: number;
    emailAttemptsLast10m: number;
    emailDistinctDeviceCount: number;
    emailDistinctIpCount: number;
    hasDeviceFingerprint: boolean;
    ipAttemptsLast10m: number;
    ipDistinctEmailCount: number;
    isNewDevice: boolean;
    isNewIp: boolean;
    previousEmailRiskScore: number;
    previousIpRiskScore: number;
    turnstileErrorCodes: string[];
  };
};

export type SignupApiSuccessResponse = {
  ok: true;
  risk: SignupRisk;
};

export type SignupApiErrorResponse = {
  error: string;
  message: string;
  ok: false;
  risk?: SignupRisk;
};

export const getSignupCooldownRemainingSeconds = (cooldownEndTimestamp: number, now = Date.now()) => {
  const remainingMs = cooldownEndTimestamp - now;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1_000) : 0;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
