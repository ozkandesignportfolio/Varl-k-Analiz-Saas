import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";

export const emailVerificationPromptMessage =
  "E-posta adresinizi dogrulamak icin gelen kutunuzu kontrol edin.";

export const emailVerificationLoginBlockedMessage =
  "Giris yapmadan once e-posta adresinizi dogrulamaniz gerekiyor.";

export const emailVerificationResentMessage =
  "Dogrulama e-postasi tekrar gonderildi.";

export const emailVerificationCompletedMessage =
  "E-posta adresiniz dogrulandi. Simdi giris yapabilirsiniz.";

const getSafeNextPath = (candidate?: string | null) => {
  if (!candidate) {
    return null;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }

  return candidate;
};

export const buildEmailVerificationPath = (email?: string | null, next?: string | null) => {
  const params = new URLSearchParams();
  const normalizedEmail = email?.trim();
  const normalizedNext = getSafeNextPath(next);

  if (normalizedEmail) {
    params.set("email", normalizedEmail);
  }

  if (normalizedNext) {
    params.set("next", normalizedNext);
  }

  const query = params.toString();
  return query ? `/verify-email?${query}` : "/verify-email";
};

export const getEmailVerificationRedirectUrl = () => getAuthRedirectUrl("/verify-email");
