export const SIGNUP_COOLDOWN_STORAGE_KEY = "signup_cooldown_end_timestamp";
export const SIGNUP_COOLDOWN_MS = 60_000;

export const EMAIL_ALREADY_EXISTS_ERROR = "email_already_exists";
export const EMAIL_RATE_LIMITED_ERROR = "email_rate_limited";
export const INTERNAL_ERROR = "internal_error";
export const INVALID_EMAIL_ERROR = "invalid_email";
export const INVALID_PASSWORD_ERROR = "invalid_password";
export const INVALID_REDIRECT_URL_ERROR = "invalid_redirect_url";
export const KVKK_CONSENT_REQUIRED_ERROR = "kvkk_consent_required";
export const MISSING_FIELDS_ERROR = "missing_fields";
export const PASSWORD_MISMATCH_ERROR = "password_mismatch";
export const PRIVACY_POLICY_NOT_ACCEPTED_ERROR = "privacy_policy_not_accepted";
export const RATE_LIMITED_ERROR = "rate_limited";
export const TERMS_NOT_ACCEPTED_ERROR = "terms_not_accepted";
export const TURNSTILE_FAILED_ERROR = "turnstile_failed";

export type SignupApiErrorCode =
  | typeof EMAIL_ALREADY_EXISTS_ERROR
  | typeof EMAIL_RATE_LIMITED_ERROR
  | typeof INTERNAL_ERROR
  | typeof INVALID_EMAIL_ERROR
  | typeof INVALID_PASSWORD_ERROR
  | typeof INVALID_REDIRECT_URL_ERROR
  | typeof KVKK_CONSENT_REQUIRED_ERROR
  | typeof MISSING_FIELDS_ERROR
  | typeof PASSWORD_MISMATCH_ERROR
  | typeof PRIVACY_POLICY_NOT_ACCEPTED_ERROR
  | typeof RATE_LIMITED_ERROR
  | typeof TERMS_NOT_ACCEPTED_ERROR
  | typeof TURNSTILE_FAILED_ERROR;

export type SignupEmailStatus = "failed" | "sent";

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
  emailStatus?: SignupEmailStatus;
  message?: string;
  ok: true;
  risk: SignupRisk;
  verified: true;
};

export type SignupApiErrorResponse = {
  error: SignupApiErrorCode;
  message: string;
  ok: false;
  risk?: SignupRisk;
  verified: false;
};

export const getSignupCooldownRemainingSeconds = (cooldownEndTimestamp: number, now = Date.now()) => {
  const remainingMs = cooldownEndTimestamp - now;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1_000) : 0;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
