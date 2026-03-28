import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

type SendEmailHookBody = {
  email?: unknown;
  email_type?: unknown;
  token?: unknown;
  redirect_to?: unknown;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_FROM = "Assetly <support@assetly.network>";

const getRequiredEnv = (name: "RESEND_API_KEY" | "EMAIL_HOOK_SECRET") => {
  const value = process.env[name]?.trim();

  if (!value) {
    const message = `[auth.send-email] Missing required env var: ${name}`;
    console.error(message);
    throw new Error(message);
  }

  return value;
};

const isAuthorizedRequest = (authorizationHeader: string | null, expectedSecret: string) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }

  const providedSecret = authorizationHeader.slice("Bearer ".length).trim();

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

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const buildSignupConfirmUrl = (redirectTo: string, token: string) => {
  const confirmUrl = new URL(redirectTo);
  confirmUrl.searchParams.set("token", token);
  return confirmUrl.toString();
};

const escapeHtml = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const sendSignupEmail = async (email: string, confirmUrl: string, resendApiKey: string) => {
  const subject = "Confirm your Assetly account";
  const safeConfirmUrl = escapeHtml(confirmUrl);

  const resendResponse = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h1 style="font-size:20px;margin-bottom:16px">Confirm your email</h1>
          <p style="margin-bottom:16px">Thanks for signing up for Assetly. Confirm your email address to activate your account.</p>
          <p style="margin-bottom:24px">
            <a
              href="${safeConfirmUrl}"
              style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px"
            >
              Confirm email
            </a>
          </p>
          <p style="margin-bottom:0">If the button does not work, open this link:</p>
          <p style="word-break:break-all;margin-top:8px">${safeConfirmUrl}</p>
        </div>
      `,
      text: `Confirm your Assetly account: ${confirmUrl}`,
    }),
  });

  if (!resendResponse.ok) {
    const responseBody = await resendResponse.text();
    console.error("[auth.send-email] Resend API request failed.", {
      status: resendResponse.status,
      body: responseBody,
    });
    throw new Error("Resend API request failed.");
  }
};

export async function POST(request: Request) {
  try {
    const emailHookSecret = getRequiredEnv("EMAIL_HOOK_SECRET");

    if (!isAuthorizedRequest(request.headers.get("authorization"), emailHookSecret)) {
      console.error("[auth.send-email] Unauthorized hook request.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: SendEmailHookBody;

    try {
      body = (await request.json()) as SendEmailHookBody;
    } catch (error) {
      console.error("[auth.send-email] Failed to parse request body.", error);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email, email_type: emailType, token, redirect_to: redirectTo } = body;

    if (
      !isNonEmptyString(email) ||
      !isNonEmptyString(emailType) ||
      !isNonEmptyString(token) ||
      !isNonEmptyString(redirectTo)
    ) {
      console.error("[auth.send-email] Missing required hook fields.", {
        email: isNonEmptyString(email),
        email_type: isNonEmptyString(emailType),
        token: isNonEmptyString(token),
        redirect_to: isNonEmptyString(redirectTo),
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (emailType !== "signup") {
      console.error("[auth.send-email] Unsupported email type.", { emailType });
      return NextResponse.json({ error: "Unsupported email type" }, { status: 400 });
    }

    const resendApiKey = getRequiredEnv("RESEND_API_KEY");
    const confirmUrl = buildSignupConfirmUrl(redirectTo, token);

    await sendSignupEmail(email, confirmUrl, resendApiKey);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[auth.send-email] Failed to send auth email.", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
