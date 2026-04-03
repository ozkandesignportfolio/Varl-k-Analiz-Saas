import "server-only";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secretKey) {
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
      return {
        action,
        errorCodes,
        hostname,
        ok: true,
      };
    }

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
