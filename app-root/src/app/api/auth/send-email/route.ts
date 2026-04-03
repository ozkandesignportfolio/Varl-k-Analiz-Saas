import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SendEmailHookBody = {
  email?: unknown;
  email_type?: unknown;
  token?: unknown;
  redirect_to?: unknown;
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

type ResendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

class MissingEnvVarError extends Error {
  constructor(public readonly envVarName: "RESEND_API_KEY" | "EMAIL_HOOK_SECRET") {
    super(`[auth.send-email] Missing required env var: ${envVarName}`);
    this.name = "MissingEnvVarError";
  }
}

const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_FROM = "Assetly <support@assetly.network>";

const getRequiredEnv = (name: "RESEND_API_KEY" | "EMAIL_HOOK_SECRET") => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new MissingEnvVarError(name);
  }

  return value;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const trimToEmpty = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const parseJsonSafely = (value: string) => {
  if (!value.trim()) {
    return {};
  }

  return JSON.parse(value) as unknown;
};

const readHookBody = async (request: Request): Promise<SendEmailHookBody> => {
  const rawBody = await request.text();
  const parsedBody = parseJsonSafely(rawBody);
  const body = asJsonObject(parsedBody) ?? {};
  return body as SendEmailHookBody;
};

const sanitizeBodyForLogs = (body: SendEmailHookBody) => ({
  email: isNonEmptyString(body.email) ? body.email.trim() : null,
  email_type: isNonEmptyString(body.email_type) ? body.email_type.trim() : null,
  redirect_to: isNonEmptyString(body.redirect_to) ? body.redirect_to.trim() : null,
  has_token: isNonEmptyString(body.token),
});

const readAuthorizationToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) {
    return null;
  }

  const normalizedHeader = authorizationHeader.trim();
  if (!normalizedHeader) {
    return null;
  }

  if (/^bearer\s+/i.test(normalizedHeader)) {
    const token = normalizedHeader.slice(normalizedHeader.indexOf(" ") + 1).trim();
    return token || null;
  }

  return normalizedHeader;
};

const isAuthorizedRequest = (authorizationHeader: string | null, expectedSecret: string) => {
  const providedSecret = readAuthorizationToken(authorizationHeader);

  if (!providedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildSignupConfirmUrl = (redirectTo: string, token: string) => {
  const confirmUrl = new URL(redirectTo);
  confirmUrl.searchParams.set("token", token);
  return confirmUrl.toString();
};

const buildSignupEmailContent = (confirmUrl: string): EmailContent => {
  const safeConfirmUrl = escapeHtml(confirmUrl);

  return {
    subject: "Confirm your email",
    html: `<h2>Confirm your email</h2><p>Click below:</p><a href="${safeConfirmUrl}">Confirm</a>`,
    text: `Confirm your email: ${confirmUrl}`,
  };
};

const buildGenericEmailContent = (): EmailContent => ({
  subject: "Notification email",
  html: "<p>Notification email</p>",
  text: "Notification email",
});

const ensureValidEmailContent = (content: EmailContent): EmailContent => {
  let html = trimToEmpty(content.html);
  let text = trimToEmpty(content.text);

  if (!html && !text) {
    html = "<p>Fallback email</p>";
    text = "Fallback email";
  }

  if (!html) {
    html = `<p>${escapeHtml(text)}</p>`;
  }

  if (!text) {
    text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "Fallback email";
  }

  return {
    subject: trimToEmpty(content.subject) || "Notification email",
    html,
    text,
  };
};

const parseResponseBody = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const sendEmail = async (email: string, content: EmailContent, resendApiKey: string) => {
  let { subject, html, text } = ensureValidEmailContent(content);

  if (!html && !text) {
    html = "<p>Fallback email</p>";
    text = "Fallback email";
  }

  const payload: ResendEmailPayload = {
    from: EMAIL_FROM,
    to: email,
    subject,
    html,
    text,
  };

  const resendResponse = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = await resendResponse.text();
  console.log("RESEND RESULT:", result);
  const resendResponseBody = parseResponseBody(result);

  console.log("[auth.send-email] Resend response.", {
    ok: resendResponse.ok,
    status: resendResponse.status,
    body: resendResponseBody,
  });

  if (!resendResponse.ok) {
    throw new Error(`Resend request failed with status ${resendResponse.status}`);
  }

  return resendResponseBody;
};

const getEmailContent = (body: SendEmailHookBody): EmailContent => {
  const normalizedEmailType = isNonEmptyString(body.email_type) ? body.email_type.trim().toLowerCase() : "";

  if (normalizedEmailType === "signup") {
    if (isNonEmptyString(body.token) && isNonEmptyString(body.redirect_to)) {
      const confirmUrl = buildSignupConfirmUrl(body.redirect_to, body.token);
      return buildSignupEmailContent(confirmUrl);
    }

    console.warn("[auth.send-email] Signup payload incomplete. Falling back to generic email.", {
      has_token: isNonEmptyString(body.token),
      has_redirect_to: isNonEmptyString(body.redirect_to),
    });
    return buildGenericEmailContent();
  }

  if (!normalizedEmailType) {
    console.warn("[auth.send-email] Missing email_type. Sending generic email.");
    return buildGenericEmailContent();
  }

  console.warn("[auth.send-email] Unknown email type. Sending generic email.", {
    emailType: normalizedEmailType,
  });
  return buildGenericEmailContent();
};

export async function POST(request: Request) {
  try {
    const emailHookSecret = getRequiredEnv("EMAIL_HOOK_SECRET");
    const authorizationHeader = request.headers.get("authorization");
    const isAuthorized = isAuthorizedRequest(authorizationHeader, emailHookSecret);

    console.log("[auth.send-email] Auth result.", {
      hasAuthorizationHeader: Boolean(authorizationHeader?.trim()),
      isAuthorized,
    });

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: SendEmailHookBody;

    try {
      body = await readHookBody(request);
    } catch (error) {
      console.error("[auth.send-email] Failed to parse request body.", error);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    console.log("[auth.send-email] Request body.", sanitizeBodyForLogs(body));

    if (!isNonEmptyString(body.email)) {
      return NextResponse.json({ error: "Missing required field: email" }, { status: 400 });
    }

    const resendApiKey = getRequiredEnv("RESEND_API_KEY");
    const email = body.email.trim();
    const emailContent = getEmailContent(body);

    await sendEmail(email, emailContent, resendApiKey);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof MissingEnvVarError) {
      console.error("[auth.send-email] Configuration error.", {
        missingEnvVar: error.envVarName,
      });

      return NextResponse.json(
        {
          error: "Server misconfiguration",
          code: "MISSING_ENV_VAR",
          missingEnvVar: error.envVarName,
        },
        { status: 500 },
      );
    }

    console.error("[auth.send-email] Failed to send auth email.", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
