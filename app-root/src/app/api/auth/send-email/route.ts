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
const EMAIL_TIMEOUT_MS = 10_000;
const INVALID_DOMAINS = ["resend.dev", "example.com"];

// EMAIL_ATTEMPT log
const logEmailAttempt = (email: string, fromEmail: string) => {
  console.log("EMAIL_ATTEMPT", {
    email,
    fromEmail,
    ts: new Date().toISOString(),
  });
};

// EMAIL_SUCCESS log
const logEmailSuccess = (email: string, providerId?: string) => {
  console.log("EMAIL_SUCCESS", {
    email,
    providerId,
    ts: new Date().toISOString(),
  });
};

// EMAIL_FAILED log
const logEmailFailed = (email: string, reason: string, error: string) => {
  console.log("EMAIL_FAILED", {
    email,
    reason,
    error,
    ts: new Date().toISOString(),
  });
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

// Validate from email domain (reject resend.dev, example.com)
const isValidFromEmail = (email: string): boolean => {
  const lowerEmail = email.toLowerCase();
  return !INVALID_DOMAINS.some((domain) => lowerEmail.includes(domain));
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
      subject: "Hesabınızı Doğrulayın - Assetly",
      html: `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hesap Doğrulama</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8fafc;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:40px 32px 24px;background:#0f172a;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Assetly</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Hesabınızı Doğrulayın</h2>
                            <p style="margin:0 0 24px;color:#334155;line-height:1.6;">
                                Assetly'e hoş geldiniz! Hesabınızı doğrulamak için aşağıdaki kodu kullanın:
                            </p>
                            <table role="presentation" style="margin:32px 0;background:#f1f5f9;border-radius:8px;padding:24px;">
                                <tr>
                                    <td style="text-align:center;">
                                        <code style="font-size:32px;font-weight:600;color:#0f172a;letter-spacing:4px;">${safeToken}</code>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.5;">
                                Bu kod 1 saat içinde geçerliliğini yitirecektir.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;background:#f1f5f9;text-align:center;">
                            <p style="margin:0;color:#64748b;font-size:12px;">
                                Assetly - Varlık Yönetim Sistemi
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
      text: `Assetly - Hesap Doğrulama

Hoş geldiniz! Hesabınızı doğrulamak için aşağıdaki kodu kullanın:

Doğrulama kodunuz: ${token}

Bu kod 1 saat içinde geçerliliğini yitirecektir.

Assetly - Varlık Yönetim Sistemi`,
    };
  }

  return {
    subject: "Şifrenizi Sıfırlayın - Assetly",
    html: `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Şifre Sıfırlama</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8fafc;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:40px 32px 24px;background:#0f172a;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Assetly</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Şifrenizi Sıfırlayın</h2>
                            <p style="margin:0 0 24px;color:#334155;line-height:1.6;">
                                Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:
                            </p>
                            <table role="presentation" style="margin:32px 0;background:#f1f5f9;border-radius:8px;padding:24px;">
                                <tr>
                                    <td style="text-align:center;">
                                        <code style="font-size:32px;font-weight:600;color:#0f172a;letter-spacing:4px;">${safeToken}</code>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.5;">
                                Bu kod 1 saat içinde geçerliliğini yitirecektir. Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;background:#f1f5f9;text-align:center;">
                            <p style="margin:0;color:#64748b;font-size:12px;">
                                Assetly - Varlık Yönetim Sistemi
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
    text: `Assetly - Şifre Sıfırlama

Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:

Şifre sıfırlama kodunuz: ${token}

Bu kod 1 saat içinde geçerliliğini yitirecektir. Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.

Assetly - Varlık Yönetim Sistemi`,
  };
};

const sendEmail = async (
  email: string,
  content: EmailContent,
  resendApiKey: string,
  fromEmail: string
): Promise<{ status: "sent" | "failed"; message: string; providerId?: string }> => {
  const body = JSON.stringify({
    from: fromEmail,
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  const sendPromise = fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json; charset=utf-8",
    },
    body,
    cache: "no-store",
  });

  const timeoutPromise = new Promise<Response>(() => {
    // Timeout'da reject et, caller yakalar
    setTimeout(() => {
      throw new Error("Email gönderim zaman aşımı (10s)");
    }, EMAIL_TIMEOUT_MS);
  });

  const response = await Promise.race([sendPromise, timeoutPromise]);

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      status: "failed",
      message: `Resend API hatası: ${response.status} - ${errorBody}`,
    };
  }

  const responseText = await response.text();
  let providerId: string | undefined;
  try {
    const parsed = JSON.parse(responseText) as { id?: string };
    providerId = parsed.id;
  } catch {
    // ignore parse error
  }

  return { status: "sent", message: "Email sent", providerId };
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
    const fromEmail = process.env.AUTOMATION_FROM_EMAIL?.trim() ?? "";

    // Validate from email
    if (!fromEmail || !isValidFromEmail(fromEmail)) {
      const errorMsg = `Geçersiz AUTOMATION_FROM_EMAIL: ${fromEmail || "boş"}. ${INVALID_DOMAINS.join(", ")} domainleri reddedildi.`;
      logEmailFailed(email, "invalid_from_email", errorMsg);
      // Do not block signup - return success even if email fails
      return NextResponse.json(
        { ok: true, warning: "Email config invalid, but signup succeeded" },
        { status: 200 }
      );
    }

    const emailContent = getEmailContent(normalizedActionType, token.trim());
    const fullFrom = `Assetly <${fromEmail}>`;

    logEmailAttempt(email, fullFrom);

    const result = await sendEmail(email.trim(), emailContent, resendApiKey, fullFrom);

    if (result.status === "sent") {
      logEmailSuccess(email, result.providerId);
      return NextResponse.json({ ok: true }, { status: 200 });
    } else {
      logEmailFailed(email, "send_failed", result.message);
      // Do not block signup - return success even if email fails
      return NextResponse.json(
        { ok: true, warning: "Email failed but signup succeeded", emailError: result.message },
        { status: 200 }
      );
    }
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
