// Email sending utility with production-safe validation and logging
// Kurallar:
// 1. resend.dev ve example.com reddedilir
// 2. EMAIL_ATTEMPT, EMAIL_SUCCESS, EMAIL_FAILED logları
// 3. 10s timeout
// 4. "sent" | "failed" dönüş
// 5. Hata durumunda signup'ı bloklamaz

const RESEND_API_URL = "https://api.resend.com/emails";
const EMAIL_TIMEOUT_MS = 10_000;

// Geçersiz domainler (production'da kullanılamaz)
const INVALID_DOMAINS = ["resend.dev", "example.com"];

export type EmailResult =
  | { status: "sent"; message: string; providerId?: string }
  | { status: "failed"; message: string; reason: string };

export interface EmailPayload {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
}

export interface EmailContext {
  userId?: string;
  email: string;
  triggerType?: string;
}

// Validation: resend.dev ve example.com kontrolü
export function isValidFromEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const lowerEmail = email.toLowerCase();
  return !INVALID_DOMAINS.some((domain) => lowerEmail.includes(domain));
}

// Validation: API key kontrolü
export function isValidApiKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== "string") return false;
  return apiKey.startsWith("re_") && apiKey.length > 10;
}

// EMAIL_ATTEMPT log
export function logEmailAttempt(context: EmailContext, fromEmail: string): void {
  console.log("EMAIL_ATTEMPT", {
    email: context.email,
    userId: context.userId,
    fromEmail,
    triggerType: context.triggerType,
    ts: new Date().toISOString(),
  });
}

// EMAIL_SUCCESS log
export function logEmailSuccess(
  context: EmailContext,
  providerId?: string
): void {
  console.log("EMAIL_SUCCESS", {
    email: context.email,
    userId: context.userId,
    providerId,
    ts: new Date().toISOString(),
  });
}

// EMAIL_FAILED log
export function logEmailFailed(
  context: EmailContext,
  reason: string,
  error: string
): void {
  console.log("EMAIL_FAILED", {
    email: context.email,
    userId: context.userId,
    reason,
    error,
    ts: new Date().toISOString(),
  });
}

// Ana email gönderme fonksiyonu - 10s timeout ile
export async function sendEmailWithTimeout(
  payload: EmailPayload,
  apiKey: string,
  context: EmailContext
): Promise<EmailResult> {
  // Önce validation yap, log at
  if (!isValidApiKey(apiKey)) {
    const reason = "invalid_api_key";
    const message = "RESEND_API_KEY geçersiz veya eksik";
    logEmailFailed(context, reason, message);
    return { status: "failed", message, reason };
  }

  if (!isValidFromEmail(payload.from)) {
    const reason = "invalid_from_email";
    const message = `AUTOMATION_FROM_EMAIL geçersiz domain içeriyor: ${INVALID_DOMAINS.join(", ")}`;
    logEmailFailed(context, reason, message);
    return { status: "failed", message, reason };
  }

  logEmailAttempt(context, payload.from);

  // Timeout ile gönderim
  const sendPromise = sendToResend(payload, apiKey);
  const timeoutPromise = new Promise<EmailResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          status: "failed",
          message: "Email gönderim zaman aşımı (10s)",
          reason: "timeout",
        }),
      EMAIL_TIMEOUT_MS
    )
  );

  try {
    const result = await Promise.race([sendPromise, timeoutPromise]);

    if (result.status === "sent") {
      logEmailSuccess(context, result.providerId);
    } else {
      logEmailFailed(context, result.reason, result.message);
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
    logEmailFailed(context, "exception", errorMsg);
    return { status: "failed", message: errorMsg, reason: "exception" };
  }
}

// Resend API çağrısı
async function sendToResend(
  payload: EmailPayload,
  apiKey: string
): Promise<EmailResult> {
  const body: Record<string, unknown> = {
    from: payload.from,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
  };

  if (payload.html) body.html = payload.html;
  if (payload.text) body.text = payload.text;
  if (payload.replyTo) {
    body.reply_to = Array.isArray(payload.replyTo)
      ? payload.replyTo
      : [payload.replyTo];
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        status: "failed",
        message: `Resend API hatası: ${response.status} - ${responseText}`,
        reason: "resend_api_error",
      };
    }

    // Başarılı yanıt - ID parse et
    let providerId: string | undefined;
    try {
      const parsed = JSON.parse(responseText) as { id?: string };
      providerId = parsed.id;
    } catch {
      // ID parse edilemezse de başarılı say
    }

    return {
      status: "sent",
      message: "Email başarıyla gönderildi",
      providerId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Ağ hatası";
    return {
      status: "failed",
      message: errorMsg,
      reason: "network_error",
    };
  }
}
