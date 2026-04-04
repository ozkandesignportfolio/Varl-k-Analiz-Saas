import "server-only";

export const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

export type TurnstileIssueCategory =
  | "domain"
  | "env"
  | "key"
  | "network"
  | "token"
  | "unknown";

export type TurnstileRequestContext = {
  headers: {
    host: string | null;
    origin: string | null;
    xForwardedHost: string | null;
  };
  requestHostname: string | null;
};

export const normalizeHostname = (value?: string | null) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  const withoutListSuffix = trimmedValue.split(",")[0]?.trim() ?? trimmedValue;

  try {
    const candidateUrl = withoutListSuffix.includes("://")
      ? withoutListSuffix
      : `https://${withoutListSuffix}`;
    const hostname = new URL(candidateUrl).hostname.trim().toLowerCase();
    return hostname || null;
  } catch {
    const withoutPort = withoutListSuffix.split(":")[0]?.trim().toLowerCase();
    return withoutPort || null;
  }
};

export const getTurnstileRequestContext = (request: Request): TurnstileRequestContext => {
  const host = request.headers.get("host")?.split(",")[0]?.trim() || null;
  const xForwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || null;
  const origin = request.headers.get("origin")?.trim() || null;
  const requestHostname =
    normalizeHostname(xForwardedHost) ??
    normalizeHostname(host) ??
    (() => {
      try {
        return new URL(request.url).hostname.trim().toLowerCase() || null;
      } catch {
        return null;
      }
    })();

  return {
    headers: {
      host,
      origin,
      xForwardedHost,
    },
    requestHostname,
  };
};

export const compareTurnstileHostnames = ({
  requestHostname,
  responseHostname,
}: {
  requestHostname?: string | null;
  responseHostname?: string | null;
}) => {
  const normalizedRequestHostname = normalizeHostname(requestHostname);
  const normalizedResponseHostname = normalizeHostname(responseHostname);
  const hostnameMismatch = Boolean(
    normalizedRequestHostname &&
      normalizedResponseHostname &&
      normalizedRequestHostname !== normalizedResponseHostname,
  );

  return {
    hostnameMismatch,
    requestHostname: normalizedRequestHostname,
    responseHostname: normalizedResponseHostname,
  };
};

export const getMaskedSiteKeyPreview = (siteKey?: string | null) => {
  const trimmedSiteKey = siteKey?.trim();

  if (!trimmedSiteKey) {
    return null;
  }

  return trimmedSiteKey.slice(0, 5);
};

export const classifyTurnstileIssue = (input: {
  errorCodes?: string[];
  hasEnvIssue?: boolean;
  hostnameMismatch?: boolean;
  reason?: "invalid" | "missing_secret" | "network_error" | null;
}) => {
  if (input.hasEnvIssue || input.reason === "missing_secret") {
    return "env";
  }

  if (input.hostnameMismatch || input.errorCodes?.includes("110200")) {
    return "domain";
  }

  if (input.errorCodes?.includes("invalid-input-secret")) {
    return "key";
  }

  if (input.reason === "network_error" || input.errorCodes?.some((code) => code.startsWith("http_"))) {
    return "network";
  }

  if (
    input.errorCodes?.includes("invalid-input-response") ||
    input.errorCodes?.includes("timeout-or-duplicate")
  ) {
    return "token";
  }

  if (input.reason === "invalid") {
    return "unknown";
  }

  return "unknown";
};
