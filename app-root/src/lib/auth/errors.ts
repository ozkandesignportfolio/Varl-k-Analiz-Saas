import "server-only";

/**
 * Auth Error Classification System
 * ================================
 *
 * Centralized error classification for consistent handling
 * across all auth flows.
 */

export type AuthErrorClassification =
  | "email_not_confirmed"
  | "rate_limit"
  | "invalid_token"
  | "expired_token"
  | "user_exists"
  | "weak_password"
  | "network_error"
  | "unknown";

type SupabaseAuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
  weak_password?: {
    message?: string | null;
    reasons?: string[] | null;
  } | null;
};

type SupabaseUserLike = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

/**
 * Check if user's email is confirmed
 */
export function isEmailConfirmed(user?: SupabaseUserLike | null): boolean {
  return Boolean(user?.email_confirmed_at);
}

/**
 * Check if error is "email not confirmed"
 */
export function isEmailConfirmedError(error?: SupabaseAuthErrorLike | null): boolean {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (code === "email_not_confirmed") return true;

  return (
    message.includes("email not confirmed") ||
    message.includes("email is not confirmed") ||
    message.includes("confirm your email")
  );
}

/**
 * Check if error is rate limit
 */
export function isRateLimitError(error?: SupabaseAuthErrorLike | null): boolean {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (
    code === "over_email_send_rate_limit" ||
    code === "email_rate_limit_exceeded" ||
    code === "over_request_rate_limit"
  ) {
    return true;
  }

  if (error.status === 429 && message.includes("email")) return true;

  return (
    message.includes("email rate limit exceeded") ||
    message.includes("too many requests") ||
    message.includes("for security purposes you can only request this after")
  );
}

/**
 * Check if error is invalid/expired token
 */
export function isInvalidTokenError(error?: SupabaseAuthErrorLike | null): boolean {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (
    code === "otp_expired" ||
    code === "flow_state_expired" ||
    code === "flow_state_not_found" ||
    code === "bad_code_verifier" ||
    code === "bad_otp" ||
    code === "token_expired" ||
    code === "email_link_invalid"
  ) {
    return true;
  }

  return (
    message.includes("expired") ||
    message.includes("invalid") ||
    message.includes("token has expired") ||
    message.includes("otp has expired") ||
    message.includes("flow state") ||
    message.includes("code verifier") ||
    message.includes("verification link")
  );
}

/**
 * Check if error is "user already exists"
 */
export function isUserExistsError(error?: SupabaseAuthErrorLike | null): boolean {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (code === "user_already_exists" || code === "email_exists") return true;

  return (
    message.includes("user already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists") ||
    message.includes("email exists")
  );
}

/**
 * Check if error is weak password
 */
export function isWeakPasswordError(error?: SupabaseAuthErrorLike | null): boolean {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);
  const weakPasswordMessage = normalize(error.weak_password?.message);
  const weakPasswordReasons = Array.isArray(error.weak_password?.reasons)
    ? error.weak_password?.reasons.map((r) => normalize(r)).filter(Boolean)
    : [];

  if (code === "weak_password") return true;

  return (
    message.includes("weak password") ||
    message.includes("password is too weak") ||
    message.includes("password should") ||
    weakPasswordMessage.includes("weak password") ||
    weakPasswordReasons.some(
      (reason) =>
        reason.includes("weak password") ||
        reason.includes("password should") ||
        reason.includes("password is too weak")
    )
  );
}

/**
 * Classify any auth error into a standard category
 */
export function classifyAuthError(error?: SupabaseAuthErrorLike | null): AuthErrorClassification {
  if (!error) return "unknown";

  if (isEmailConfirmedError(error)) return "email_not_confirmed";
  if (isRateLimitError(error)) return "rate_limit";
  if (isInvalidTokenError(error)) return "invalid_token";
  if (isUserExistsError(error)) return "user_exists";
  if (isWeakPasswordError(error)) return "weak_password";

  const message = normalize(error.message);
  if (message.includes("network") || message.includes("fetch") || message.includes("connection")) {
    return "network_error";
  }

  return "unknown";
}

/**
 * Get user-friendly error message in Turkish
 */
export function getErrorMessage(classification: AuthErrorClassification): string {
  const messages: Record<AuthErrorClassification, string> = {
    email_not_confirmed: "E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin.",
    rate_limit: "Çok fazla istek gönderildi. Lütfen kısa bir süre sonra tekrar deneyin.",
    invalid_token: "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
    expired_token: "Doğrulama bağlantısının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.",
    user_exists: "Bu e-posta adresiyle bir hesap zaten var. Lütfen giriş yapın.",
    weak_password: "Şifreniz çok zayıf. Lütfen daha güçlü bir şifre seçin.",
    network_error: "Bağlantı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.",
    unknown: "Bir hata oluştu. Lütfen tekrar deneyin.",
  };

  return messages[classification];
}
