import { isProductionNodeEnv } from "@/lib/env/build-env";
import { PublicEnv } from "@/lib/env/public-env";

export const TURNSTILE_SITE_KEY_MISSING_MESSAGE =
  "Guvenlik dogrulamasi yuklenemedi";
export const TURNSTILE_LOCALHOST_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_DOMAIN_INACTIVE_MESSAGE =
  "G\u00fcvenlik do\u011frulamas\u0131 bu domain i\u00e7in aktif de\u011fil. L\u00fctfen site y\u00f6neticisine bildirin.";

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

export const isDevelopmentEnvironment = () => !isProductionNodeEnv();

export const isLocalhostTestTurnstileSiteKey = (siteKey?: string | null) =>
  normalizeEnvValue(siteKey ?? undefined) === TURNSTILE_LOCALHOST_TEST_SITE_KEY;

export const isLocalhostTurnstileHost = (hostname?: string | null) => {
  const normalizedHostname = hostname?.trim().toLowerCase();

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "[::1]"
  );
};

export const canUseLocalhostTurnstileTestKeys = (hostname?: string | null) =>
  isDevelopmentEnvironment() && isLocalhostTurnstileHost(hostname);

export const resolveTurnstileSiteKeyForHostname = ({
  configuredSiteKey,
  hostname,
}: {
  configuredSiteKey?: string | null;
  hostname?: string | null;
}) => {
  if (canUseLocalhostTurnstileTestKeys(hostname)) {
    return TURNSTILE_LOCALHOST_TEST_SITE_KEY;
  }

  return normalizeEnvValue(configuredSiteKey ?? undefined);
};

export const readPublicTurnstileSiteKey = (): PublicTurnstileSiteKeyResult => {
  const rawValue = PublicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const siteKey = normalizeEnvValue(rawValue);

  return {
    isConfigured: Boolean(siteKey),
    rawValue,
    siteKey,
    warning: siteKey ? null : TURNSTILE_SITE_KEY_MISSING_MESSAGE,
  };
};

export const debugPublicTurnstileSiteKey = () => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const { siteKey, warning } = readPublicTurnstileSiteKey();
  console.debug("[turnstile.env] Client env debug.", {
    hasSiteKey: Boolean(siteKey),
    siteKeyLength: siteKey?.length ?? 0,
    warning,
  });
};
