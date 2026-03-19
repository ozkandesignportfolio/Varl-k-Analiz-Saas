import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";

export const emailVerificationSentMessage =
  "E-posta adresinize doğrulama kodu gönderildi";

export const emailVerificationPromptMessage =
  "E-posta adresinizi doğrulamak için gelen kutunuzu kontrol edin.";

export const emailVerificationLoginBlockedMessage =
  "Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.";

export const emailVerificationResentMessage =
  "Doğrulama e-postası tekrar gönderildi.";

export const emailVerificationCompletedMessage =
  "E-posta adresiniz doğrulandı.";

const getSafeNextPath = (candidate?: string | null) => {
  if (!candidate) {
    return null;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }

  return candidate;
};

export const buildEmailVerificationPath = (
  email?: string | null,
  next?: string | null,
  options?: { emailSent?: boolean },
) => {
  const params = new URLSearchParams();
  const normalizedEmail = email?.trim();
  const normalizedNext = getSafeNextPath(next);
  const emailSent = options?.emailSent ?? false;

  if (normalizedEmail) {
    params.set("email", normalizedEmail);
  }

  if (normalizedNext) {
    params.set("next", normalizedNext);
  }

  if (emailSent) {
    params.set("sent", "1");
  }

  const query = params.toString();
  return query ? `/verify-email?${query}` : "/verify-email";
};

export const getEmailVerificationRedirectUrl = () => getAuthRedirectUrl("/dashboard");
