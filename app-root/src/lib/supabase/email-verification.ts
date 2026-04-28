import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";

export const emailVerificationSentMessage =
  "E-posta adresinize doğrulama kodu gönderildi.";

export const emailVerificationPromptMessage =
  "E-posta adresinize gönderilen 6 haneli doğrulama kodunu girin.";

export const emailVerificationLoginBlockedMessage =
  "E-posta adresinizi doğrulamadan giriş yapamazsınız.";

export const emailVerificationResentMessage =
  "Yeni doğrulama kodu e-posta adresinize gönderildi.";

export const emailVerificationCompletedMessage =
  "E-posta adresiniz doğrulandı.";

export const emailVerificationRedirectConfigErrorMessage =
  "E-posta doğrulama yönlendirmesi oluşturulamadı. NEXT_PUBLIC_APP_URL, APP_URL ve Supabase Auth Redirect URLs ayarlarını kontrol edin.";

export const emailVerificationConfigMismatchMessage =
  'Supabase e-posta doğrulaması şu anda güvenli biçimde tamamlanamıyor. Auth > Providers > Email altında "Confirm email" açık olmalı.';

export const invalidVerificationLinkMessage =
  "Doğrulama kodu geçersiz veya süresi dolmuş. Lütfen yeni bir kod isteyin.";

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

export const buildLoginPath = (
  next?: string | null,
  options?: {
    email?: string | null;
    emailVerified?: boolean;
    emailVerificationRequired?: boolean;
  },
) => {
  const params = new URLSearchParams();
  const normalizedNext = getSafeNextPath(next);
  const normalizedEmail = options?.email?.trim();

  if (normalizedNext) {
    params.set("next", normalizedNext);
  }

  if (normalizedEmail) {
    params.set("email", normalizedEmail);
  }

  if (options?.emailVerified) {
    params.set("email_verified", "1");
  }

  if (options?.emailVerificationRequired) {
    params.set("email_verification_required", "1");
  }

  const query = params.toString();
  return query ? `/login?${query}` : "/login";
};

export const getEmailVerificationRedirectUrl = () => getAuthRedirectUrl("/verify-email");
