export const TURNSTILE_SITE_KEY_MISSING_MESSAGE =
  "Turnstile site key is not configured. Please set NEXT_PUBLIC_TURNSTILE_SITE_KEY in your environment.";

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
  const { rawValue } = readPublicTurnstileSiteKey();
  console.debug("[turnstile] process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY =", rawValue);
};
