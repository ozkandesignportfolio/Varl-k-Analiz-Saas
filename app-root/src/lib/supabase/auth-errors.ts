type SupabaseAuthErrorLike = {
  code?: string | null;
  message?: string | null;
  status?: number | null;
};

type SupabaseUserLike = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

export const isDevelopmentEnvironment = () => process.env.NODE_ENV === "development";

export const isSupabaseUserEmailConfirmed = (user?: SupabaseUserLike | null) =>
  Boolean(user?.email_confirmed_at);

export const isEmailNotConfirmedError = (error?: SupabaseAuthErrorLike | null) => {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (code === "email_not_confirmed") {
    return true;
  }

  return (
    message.includes("email not confirmed") ||
    message.includes("email is not confirmed") ||
    message.includes("confirm your email")
  );
};

export const isEmailRateLimitError = (error?: SupabaseAuthErrorLike | null) => {
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

  if (error.status === 429 && message.includes("email")) {
    return true;
  }

  return (
    message.includes("email rate limit exceeded") ||
    message.includes("too many requests") ||
    message.includes("for security purposes you can only request this after")
  );
};

export const isInvalidEmailVerificationError = (error?: SupabaseAuthErrorLike | null) => {
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
};

export const isUserAlreadyRegisteredError = (error?: SupabaseAuthErrorLike | null) => {
  if (!error) return false;

  const code = normalize(error.code);
  const message = normalize(error.message);

  if (code === "user_already_exists" || code === "email_exists") {
    return true;
  }

  return message.includes("user already registered");
};
