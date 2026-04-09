export const SIGNUP_COOLDOWN_STORAGE_KEY = "signup_cooldown_end_timestamp";
export const SIGNUP_COOLDOWN_MS = 60_000;

export const EMAIL_ALREADY_EXISTS_ERROR = "email_already_exists";
export const EMAIL_RATE_LIMITED_ERROR = "email_rate_limited";
export const INVALID_TURNSTILE_ERROR = "invalid_turnstile";
export const INVALID_EMAIL_ERROR = "invalid_email";
export const INVALID_REDIRECT_URL_ERROR = "invalid_redirect_url";
export const KVKK_CONSENT_REQUIRED_ERROR = "kvkk_consent_required";
export const MISSING_FIELDS_ERROR = "missing_fields";
export const PASSWORD_MISMATCH_ERROR = "password_mismatch";
export const PRIVACY_POLICY_NOT_ACCEPTED_ERROR = "privacy_policy_not_accepted";
export const RATE_LIMITED_ERROR = "rate_limited";
export const SUPABASE_ERROR = "supabase_error";
export const TERMS_NOT_ACCEPTED_ERROR = "terms_not_accepted";
export const TURNSTILE_TOKEN_USED_ERROR = "turnstile_token_used";
export const WEAK_PASSWORD_ERROR = "weak_password";

export const INTERNAL_ERROR = SUPABASE_ERROR;
export const INVALID_PASSWORD_ERROR = WEAK_PASSWORD_ERROR;
export const TURNSTILE_FAILED_ERROR = INVALID_TURNSTILE_ERROR;

export type SignupApiErrorCode =
  | typeof EMAIL_ALREADY_EXISTS_ERROR
  | typeof EMAIL_RATE_LIMITED_ERROR
  | typeof INVALID_TURNSTILE_ERROR
  | typeof INVALID_EMAIL_ERROR
  | typeof INVALID_REDIRECT_URL_ERROR
  | typeof KVKK_CONSENT_REQUIRED_ERROR
  | typeof MISSING_FIELDS_ERROR
  | typeof PASSWORD_MISMATCH_ERROR
  | typeof PRIVACY_POLICY_NOT_ACCEPTED_ERROR
  | typeof RATE_LIMITED_ERROR
  | typeof SUPABASE_ERROR
  | typeof TERMS_NOT_ACCEPTED_ERROR
  | typeof TURNSTILE_TOKEN_USED_ERROR
  | typeof WEAK_PASSWORD_ERROR;

export type SignupEmailStatus = "failed" | "sent";
export type SignupTurnstileIssueCategory = "domain" | "env" | "key" | "network" | "token" | "unknown";

export type SignupApiTurnstileDiagnostics = {
  errorCodes: string[];
  hostnameMismatch: boolean;
  issue: SignupTurnstileIssueCategory;
  requestHostname: string | null;
  responseHostname: string | null;
};

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
  emailError?: string | null;
  emailSent: boolean;
  emailStatus: SignupEmailStatus;
  message: string;
  ok: true;
  requestId: string;
  risk: SignupRisk;
  userCreated: true;
  userId?: string;
  verified: true;
  warning?: string | null;
};

export type SignupApiErrorReason =
  | "duplicate_email"
  | "email_rate_limited"
  | "invalid_email"
  | "invalid_redirect_url"
  | "missing_fields"
  | "password_mismatch"
  | "signup_bootstrap_failed"
  | "signup_service_unavailable"
  | "supabase_user_create_failed"
  | "terms_not_accepted"
  | "privacy_policy_not_accepted"
  | "kvkk_consent_required"
  | "turnstile_already_used"
  | "turnstile_hostname_mismatch"
  | "turnstile_invalid_or_expired"
  | "turnstile_missing"
  | "turnstile_network_error"
  | "turnstile_server_misconfigured"
  | "weak_password";

export type SignupApiErrorDetails = {
  field?: "email" | "form" | "password" | "service" | "turnstile";
  reason: SignupApiErrorReason;
  retryable: boolean;
  shouldResetTurnstile?: boolean;
};

export type SignupApiErrorResponse = {
  details?: SignupApiErrorDetails;
  error: SignupApiErrorCode;
  message: string;
  ok: false;
  requestId: string;
  risk?: SignupRisk;
  turnstile?: SignupApiTurnstileDiagnostics;
  verified: false;
};

export const getSignupCooldownRemainingSeconds = (cooldownEndTimestamp: number, now = Date.now()) => {
  const remainingMs = cooldownEndTimestamp - now;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1_000) : 0;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
