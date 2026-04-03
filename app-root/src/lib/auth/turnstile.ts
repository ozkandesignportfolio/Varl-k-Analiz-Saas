import "server-only";

import { logTurnstileEnvDebug, readTurnstileServerEnv } from "@/lib/env/turnstile-server";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const isDevelopmentEnvironment = () => process.env.NODE_ENV === "development";

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
      hostname: string | null;
      ok: true;
    }
  | {
      action: string | null;
      errorCodes: string[];
      hostname: string | null;
      ok: false;
      reason: "invalid" | "missing_secret" | "network_error";
    };

export const verifyTurnstileToken = async ({
  remoteIp,
  token,
}: {
  remoteIp?: string | null;
  token: string;
}): Promise<TurnstileValidationResult> => {
  const { secretKey } = readTurnstileServerEnv();

  if (!secretKey) {
    logTurnstileEnvDebug("verifyTurnstileToken.missing_secret");
    return {
      action: null,
      errorCodes: [],
      hostname: null,
      ok: false,
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
      logTurnstileDebug("Turnstile verify endpoint returned a non-OK status.", {
        remoteIpPresent: Boolean(remoteIp?.trim()),
        status: response.status,
      });

      return {
        action: null,
        errorCodes: [`http_${response.status}`],
        hostname: null,
        ok: false,
        reason: "network_error",
      };
    }

    const payload = (await response.json().catch(() => null)) as TurnstileVerifyResponse | null;
    const action = payload?.action?.trim() || null;
    const errorCodes = Array.isArray(payload?.["error-codes"]) ? payload?.["error-codes"].filter(Boolean) : [];
    const hostname = payload?.hostname?.trim() || null;

    if (payload?.success === true) {
      logTurnstileDebug("Turnstile verification succeeded.", {
        action,
        errorCodeCount: errorCodes.length,
        hostname,
      });

      return {
        action,
        errorCodes,
        hostname,
        ok: true,
      };
    }

    logTurnstileDebug("Turnstile verification rejected the token.", {
      action,
      errorCodes,
      hostname,
    });

    return {
      action,
      errorCodes,
      hostname,
      ok: false,
      reason: "invalid",
    };
  } catch (error) {
    console.error("[auth.signup] Turnstile verification failed.", error);
    return {
      action: null,
      errorCodes: ["network_error"],
      hostname: null,
      ok: false,
      reason: "network_error",
    };
  }
};
