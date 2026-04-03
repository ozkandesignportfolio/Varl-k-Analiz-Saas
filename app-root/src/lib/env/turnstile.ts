export const TURNSTILE_SITE_KEY_MISSING_MESSAGE =
  "Bot korumasi su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.";

export type PublicTurnstileSiteKeyResult = {
  isConfigured: boolean;
  rawValue: string | undefined;
  siteKey: string | null;
  warning: string | null;
};

const normalizeEnvValue = (value: string | undefined) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

export const readPublicTurnstileSiteKey = (): PublicTurnstileSiteKeyResult => {
  const rawValue =
    typeof process !== "undefined" && process.env
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;
  const siteKey = normalizeEnvValue(rawValue);

  return {
    isConfigured: Boolean(siteKey),
    rawValue,
    siteKey,
    warning: siteKey ? null : TURNSTILE_SITE_KEY_MISSING_MESSAGE,
  };
};

export const debugPublicTurnstileSiteKey = () => {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const { siteKey, warning } = readPublicTurnstileSiteKey();
  console.debug("[turnstile.env] Client env debug.", {
    hasSiteKey: Boolean(siteKey),
    siteKeyLength: siteKey?.length ?? 0,
    warning,
  });
};
