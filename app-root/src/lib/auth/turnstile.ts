import "server-only";

import {
  classifyTurnstileIssue,
  compareTurnstileHostnames,
} from "@/lib/auth/turnstile-diagnostics";
import { canUseLocalhostTurnstileTestKeys, isDevelopmentEnvironment } from "@/lib/env/turnstile";
import {
  TURNSTILE_LOCALHOST_TEST_SECRET_KEY,
  logTurnstileEnvDebug,
  readTurnstileServerEnv,
} from "@/lib/env/turnstile-server";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const logTurnstileDebug = (message: string, details?: Record<string, unknown>) => {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  console.info(`[auth.signup] ${message}`, details ?? {});
};

type TurnstileVerifyResponse = {
  action?: string;
  "error-codes"?: string[];
  hostname?: string;
  success?: boolean;
};

export type TurnstileValidationResult =
  | {
      action: string | null;
      errorCodes: string[];
      hostnameMismatch: boolean;
      hostname: string | null;
      issue: "domain" | "env" | "key" | "network" | "token" | "unknown";
      ok: true;
      requestHostname: string | null;
    }
  | {
      action: string | null;
      errorCodes: string[];
      hostnameMismatch: boolean;
      hostname: string | null;
      issue: "domain" | "env" | "key" | "network" | "token" | "unknown";
      ok: false;
      requestHostname: string | null;
      reason: "invalid" | "missing_secret" | "network_error";
    };

export const verifyTurnstileToken = async ({
  requestHost,
  remoteIp,
  token,
}: {
  requestHost?: string | null;
  remoteIp?: string | null;
  token: string;
}): Promise<TurnstileValidationResult> => {
  const { secretKey: configuredSecretKey } = readTurnstileServerEnv();
  const normalizedRequestHost = requestHost?.split(":")[0]?.trim() ?? null;
  const useLocalhostTestSecret = canUseLocalhostTurnstileTestKeys(normalizedRequestHost);
  const secretKey = useLocalhostTestSecret
    ? TURNSTILE_LOCALHOST_TEST_SECRET_KEY
    : configuredSecretKey;

  if (!secretKey) {
    logTurnstileEnvDebug("verifyTurnstileToken.missing_secret");
    console.error("[auth.signup] Turnstile secret key is unavailable for verification.", {
      requestHost: normalizedRequestHost,
      usingLocalhostTestSecret: useLocalhostTestSecret,
    });
    return {
      action: null,
      errorCodes: [],
      hostnameMismatch: false,
      hostname: null,
      issue: "env",
      ok: false,
      requestHostname: normalizedRequestHost,
      reason: "missing_secret",
    };
  }

  const body = new URLSearchParams();
  body.set("secret", secretKey);
  body.set("response", token.trim());

  if (remoteIp?.trim() && remoteIp !== "unknown") {
    body.set("remoteip", remoteIp.trim());
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("[auth.signup] Turnstile verify endpoint returned a non-OK status.", {
        remoteIpPresent: Boolean(remoteIp?.trim()),
        requestHost: normalizedRequestHost,
        status: response.status,
        usingLocalhostTestSecret: useLocalhostTestSecret,
      });

      return {
        action: null,
        errorCodes: [`http_${response.status}`],
        hostnameMismatch: false,
        hostname: null,
        issue: "network",
        ok: false,
        requestHostname: normalizedRequestHost,
        reason: "network_error",
      };
    }

    const payload = (await response.json().catch(() => null)) as TurnstileVerifyResponse | null;
    const action = payload?.action?.trim() || null;
    const errorCodes = Array.isArray(payload?.["error-codes"]) ? payload?.["error-codes"].filter(Boolean) : [];
    const hostname = payload?.hostname?.trim() || null;
    const { hostnameMismatch, requestHostname, responseHostname } = compareTurnstileHostnames({
      requestHostname: normalizedRequestHost,
      responseHostname: hostname,
    });
    const issue = classifyTurnstileIssue({
      errorCodes,
      hostnameMismatch,
      reason: payload?.success === true ? null : "invalid",
    });

    console.info("[auth.signup] Turnstile verify response received.", {
      errorCodes,
      hostname: responseHostname,
      requestHostname,
      success: payload?.success === true,
      usingLocalhostTestSecret: useLocalhostTestSecret,
    });

    if (hostnameMismatch) {
      console.error("[auth.signup] TURNSTILE HOSTNAME MISMATCH", {
        errorCodes,
        requestHostname,
        responseHostname,
        usingLocalhostTestSecret: useLocalhostTestSecret,
      });
    }

    if (payload?.success === true) {
      logTurnstileDebug("Turnstile verification succeeded.", {
        action,
        errorCodeCount: errorCodes.length,
        hostname: responseHostname,
        hostnameMismatch,
        requestHostname,
        usingTestSecret: useLocalhostTestSecret,
      });

      return {
        action,
        errorCodes,
        hostname: responseHostname,
        hostnameMismatch,
        issue,
        ok: true,
        requestHostname,
      };
    }

    logTurnstileDebug("Turnstile verification rejected the token.", {
      action,
      errorCodes,
      hostname: responseHostname,
      hostnameMismatch,
      requestHostname,
      usingTestSecret: useLocalhostTestSecret,
    });

    return {
      action,
      errorCodes,
      hostname: responseHostname,
      hostnameMismatch,
      issue,
      ok: false,
      requestHostname,
      reason: "invalid",
    };
  } catch (error) {
    console.error("[auth.signup] Turnstile verification failed.", {
      error,
      remoteIpPresent: Boolean(remoteIp?.trim()),
      requestHost: normalizedRequestHost,
      usingLocalhostTestSecret: useLocalhostTestSecret,
    });
    return {
      action: null,
      errorCodes: ["network_error"],
      hostnameMismatch: false,
      hostname: null,
      issue: "network",
      ok: false,
      requestHostname: normalizedRequestHost,
      reason: "network_error",
    };
  }
};
