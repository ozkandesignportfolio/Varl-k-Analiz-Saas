import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";

export const emailVerificationSentMessage =
  "E-posta adresinize dogrulama baglantisi gonderildi.";

export const emailVerificationPromptMessage =
  "E-posta adresinizi dogrulamak icin gelen kutunuzu kontrol edin.";

export const emailVerificationLoginBlockedMessage =
  "Giris yapmadan once e-posta adresinizi dogrulamaniz gerekiyor.";

export const emailVerificationResentMessage =
  "Dogrulama e-postasi tekrar gonderildi.";

export const emailVerificationCompletedMessage =
  "E-posta adresiniz dogrulandi.";

export const emailVerificationRedirectConfigErrorMessage =
  "E-posta dogrulama yonlendirmesi olusturulamadi. NEXT_PUBLIC_APP_URL, APP_URL ve Supabase Auth Redirect URLs ayarlarini kontrol edin.";

export const emailVerificationConfigMismatchMessage =
  'Supabase e-posta dogrulamasi su anda guvenli bicimde tamamlanamiyor. Auth > Providers > Email altinda "Confirm email" acik olmali.';

export const invalidVerificationLinkMessage =
  "Dogrulama baglantisi gecersiz veya suresi dolmus. Lutfen yeni bir baglanti isteyin.";

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
