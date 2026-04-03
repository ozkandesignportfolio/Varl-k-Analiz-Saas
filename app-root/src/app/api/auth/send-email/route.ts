import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";

export const runtime = "nodejs";

type SupportedEmailActionType = "signup" | "recovery";

type SendEmailHookPayload = {
  user?: {
    email?: unknown;
  };
  email_data?: {
    token?: unknown;
    email_action_type?: unknown;
  };
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

class MissingEnvVarError extends Error {
  constructor(public readonly envVarName: "RESEND_API_KEY" | "SEND_EMAIL_HOOK_SECRET") {
    super(`Missing required env var: ${envVarName}`);
    this.name = "MissingEnvVarError";
  }
}

const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_FROM = "Assetly <onboarding@resend.dev>";

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const getRequiredEnv = (name: "RESEND_API_KEY" | "SEND_EMAIL_HOOK_SECRET") => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new MissingEnvVarError(name);
  }

  return value;
};

const normalizeWebhookSecret = (secret: string) => {
  return secret.trim().replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
};

const getWebhookHeaders = (headers: Headers) => {
  const normalizedHeaders = Object.fromEntries(headers.entries());

  if (normalizedHeaders["svix-id"] && !normalizedHeaders["webhook-id"]) {
    normalizedHeaders["webhook-id"] = normalizedHeaders["svix-id"];
  }

  if (normalizedHeaders["svix-timestamp"] && !normalizedHeaders["webhook-timestamp"]) {
    normalizedHeaders["webhook-timestamp"] = normalizedHeaders["svix-timestamp"];
  }

  if (normalizedHeaders["svix-signature"] && !normalizedHeaders["webhook-signature"]) {
    normalizedHeaders["webhook-signature"] = normalizedHeaders["svix-signature"];
  }

  return normalizedHeaders;
};

const parsePayload = (rawBody: string) => {
  const parsed = JSON.parse(rawBody) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as SendEmailHookPayload;
};

const getEmailContent = (actionType: SupportedEmailActionType, token: string): EmailContent => {
  const safeToken = token
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  if (actionType === "signup") {
    return {
      subject: "Confirm your account",
      html: `<p>Your code is <strong>${safeToken}</strong></p>`,
      text: `Your code is ${token}`,
    };
  }

  return {
    subject: "Reset your password",
    html: `<p>Your password reset code is <strong>${safeToken}</strong></p>`,
    text: `Your password reset code is ${token}`,
  };
};

const sendEmail = async (email: string, content: EmailContent, resendApiKey: string) => {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    }),
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const errorBody = await response.text();
  throw new Error(`Resend request failed with status ${response.status}: ${errorBody}`);
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const webhookSecret = getRequiredEnv("SEND_EMAIL_HOOK_SECRET");
    const webhook = new Webhook(normalizeWebhookSecret(webhookSecret));

    try {
      webhook.verify(rawBody, getWebhookHeaders(request.headers));
    } catch (error) {
      console.error("[auth.send-email] Webhook verification failed.", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: SendEmailHookPayload | null = null;

    try {
      payload = parsePayload(rawBody);
    } catch (error) {
      console.error("[auth.send-email] Invalid JSON body.", error);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!payload) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const email = payload.user?.email;
    const token = payload.email_data?.token;
    const emailActionType = payload.email_data?.email_action_type;

    if (!isNonEmptyString(email)) {
      return NextResponse.json({ error: "Missing required field: user.email" }, { status: 400 });
    }

    if (!isNonEmptyString(token)) {
      return NextResponse.json({ error: "Missing required field: email_data.token" }, { status: 400 });
    }

    if (!isNonEmptyString(emailActionType)) {
      return NextResponse.json({ error: "Missing required field: email_data.email_action_type" }, { status: 400 });
    }

    const normalizedActionType = emailActionType.trim().toLowerCase();

    if (normalizedActionType !== "signup" && normalizedActionType !== "recovery") {
      return NextResponse.json(
        { error: "Unsupported email action type", email_action_type: normalizedActionType },
        { status: 400 },
      );
    }

    const resendApiKey = getRequiredEnv("RESEND_API_KEY");
    const emailContent = getEmailContent(normalizedActionType, token.trim());

    await sendEmail(email.trim(), emailContent, resendApiKey);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof MissingEnvVarError) {
      console.error("[auth.send-email] Missing env var.", error.envVarName);
      return NextResponse.json(
        {
          error: "Server misconfiguration",
          missingEnvVar: error.envVarName,
        },
        { status: 500 },
      );
    }

    console.error("[auth.send-email] Failed to send auth email.", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
