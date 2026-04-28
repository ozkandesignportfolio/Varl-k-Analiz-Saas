import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";
import {
  generateVerificationCode,
  hashVerificationCode,
  getCodeExpiryTimestamp,
} from "@/lib/auth/verification-code";

export const runtime = "nodejs";

const ROUTE_TAG = "[auth.resend-verification]";
const RESEND_API_URL = "https://api.resend.com/emails";
const LOOKUP_MAX_PAGES = 20;
const LOOKUP_PAGE_SIZE = 100;
const DEFAULT_FROM_EMAIL = "Assetly <onboarding@resend.dev>";

type ResendBody = {
  email?: unknown;
};

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const createAdminClient = () => {
  const url = ServerEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const findUserByEmail = async (
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string,
) => {
  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LOOKUP_PAGE_SIZE,
    });
    if (error) throw new Error(`User lookup failed: ${error.message}`);
    const found = data.users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === email,
    );
    if (found) return found;
    if (data.users.length < LOOKUP_PAGE_SIZE) break;
  }
  return null;
};

const buildCodeEmailHtml = (firstName: string, code: string) =>
  `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8fafc;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        <tr><td style="padding:40px 32px 24px;background:#0f172a;text-align:center;">
          <img src="https://www.assetly.network/icons/icon-192-v2.png" alt="Assetly" style="height:56px;width:56px;display:block;margin:0 auto 12px;border-radius:12px;" />
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Assetly</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Do\u011frulama Kodunuz</h2>
          <p style="margin:0 0 12px;color:#334155;line-height:1.6;">Merhaba ${firstName || ""},</p>
          <p style="margin:0 0 24px;color:#334155;line-height:1.6;">Hesab\u0131n\u0131z\u0131 do\u011frulamak i\u00e7in a\u015fa\u011f\u0131daki kodu kullan\u0131n:</p>
          <table role="presentation" style="width:100%;margin:24px 0;">
            <tr><td style="text-align:center;background:#f1f5f9;border-radius:12px;padding:24px;">
              <code style="font-size:36px;font-weight:700;color:#0f172a;letter-spacing:8px;">${code}</code>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.5;">Bu kod 10 dakika i\u00e7inde ge\u00e7erlili\u011fini yitirecektir.</p>
          <p style="margin:8px 0 0;color:#64748b;font-size:14px;line-height:1.5;">E\u011fer bu i\u015flemi siz ba\u015flatmad\u0131ysan\u0131z, bu e-postay\u0131 dikkate almayabilirsiniz.</p>
        </td></tr>
        <tr><td style="padding:24px 32px;background:#f1f5f9;text-align:center;">
          <p style="margin:0;color:#64748b;font-size:12px;">Assetly - Varl\u0131k Y\u00f6netim Sistemi</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const buildCodeEmailText = (firstName: string, code: string) =>
  [
    `Merhaba ${firstName || ""},`,
    "",
    "Hesab\u0131n\u0131z\u0131 do\u011frulamak i\u00e7in a\u015fa\u011f\u0131daki kodu kullan\u0131n:",
    "",
    `Do\u011frulama kodunuz: ${code}`,
    "",
    "Bu kod 10 dakika i\u00e7inde ge\u00e7erlili\u011fini yitirecektir.",
    "E\u011fer bu i\u015flemi siz ba\u015flatmad\u0131ysan\u0131z, bu e-postay\u0131 dikkate almayabilirsiniz.",
    "",
    "Assetly - Varl\u0131k Y\u00f6netim Sistemi",
  ].join("\n");

export async function POST(request: Request) {
  let body: ResendBody;
  try {
    body = (await request.json()) as ResendBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Geçersiz istek." },
      { status: 400 },
    );
  }

  const email = isNonEmptyString(body.email)
    ? body.email.trim().toLowerCase()
    : "";

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_email", message: "E-posta adresi zorunludur." },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    console.error(`${ROUTE_TAG} Missing Supabase env vars.`);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "Sunucu yapılandırma hatası." },
      { status: 500 },
    );
  }

  // Find user - don't reveal whether account exists for security
  let user;
  try {
    user = await findUserByEmail(adminClient, email);
  } catch (err) {
    console.error(`${ROUTE_TAG} User lookup error.`, err);
    return NextResponse.json(
      { ok: true, message: "Eğer bu e-posta ile kayıtlı bir hesap varsa, yeni doğrulama kodu gönderildi." },
    );
  }

  if (!user) {
    // Don't reveal account non-existence
    return NextResponse.json({
      ok: true,
      message: "Eğer bu e-posta ile kayıtlı bir hesap varsa, yeni doğrulama kodu gönderildi.",
    });
  }

  if (user.email_confirmed_at) {
    return NextResponse.json(
      {
        ok: false,
        error: "already_verified",
        message: "Bu hesap zaten doğrulanmış. Giriş yapabilirsiniz.",
      },
      { status: 400 },
    );
  }

  // Generate new code
  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const expiresAt = getCodeExpiryTimestamp();

  const currentMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName =
    typeof currentMeta.first_name === "string" ? currentMeta.first_name : "";

  // Store new code hash in user_metadata
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...currentMeta,
        verification: {
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
        },
      },
    },
  );

  if (updateError) {
    console.error(`${ROUTE_TAG} Failed to store new code.`, updateError);
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: "Doğrulama kodu oluşturulamadı. Lütfen tekrar deneyin.",
      },
      { status: 500 },
    );
  }

  // Send email
  const resendApiKey = ServerEnv.RESEND_API_KEY;
  const fromEmail = ServerEnv.AUTOMATION_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;

  if (!resendApiKey) {
    console.error(`${ROUTE_TAG} RESEND_API_KEY missing.`);
    return NextResponse.json(
      {
        ok: false,
        error: "email_config",
        message: "E-posta yapılandırması eksik. Lütfen yöneticiyle iletişime geçin.",
      },
      { status: 500 },
    );
  }

  try {
    const emailResponse = await Promise.race([
      fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: "Do\u011frulama kodunuz - Assetly",
          html: buildCodeEmailHtml(firstName, code),
          text: buildCodeEmailText(firstName, code),
        }),
        cache: "no-store" as const,
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("Email timeout (10s)")), 10_000),
      ),
    ]);

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error(`${ROUTE_TAG} Resend API error.`, {
        status: emailResponse.status,
        body: errText,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "email_failed",
          message: "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.",
        },
        { status: 500 },
      );
    }

    console.log("RESEND_CODE_SUCCESS", { email, userId: user.id });

    return NextResponse.json({
      ok: true,
      message: "Yeni doğrulama kodu e-posta adresinize gönderildi.",
    });
  } catch (err) {
    console.error(`${ROUTE_TAG} Email send error.`, err);
    return NextResponse.json(
      {
        ok: false,
        error: "email_failed",
        message: "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.",
      },
      { status: 500 },
    );
  }
}
