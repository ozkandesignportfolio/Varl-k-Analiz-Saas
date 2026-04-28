import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";
import {
  hashVerificationCode,
  isCodeExpired,
  isMaxAttemptsReached,
  MAX_VERIFICATION_ATTEMPTS,
  type VerificationMetadata,
} from "@/lib/auth/verification-code";
import { bootstrapUserRecords } from "@/lib/auth/user-bootstrap";

export const runtime = "nodejs";

const ROUTE_TAG = "[auth.verify-code]";
const LOOKUP_MAX_PAGES = 20;
const LOOKUP_PAGE_SIZE = 100;

type VerifyCodeBody = {
  email?: unknown;
  code?: unknown;
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

export async function POST(request: Request) {
  let body: VerifyCodeBody;
  try {
    body = (await request.json()) as VerifyCodeBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Geçersiz istek." },
      { status: 400 },
    );
  }

  const email = isNonEmptyString(body.email)
    ? body.email.trim().toLowerCase()
    : "";
  const code = isNonEmptyString(body.code) ? body.code.trim() : "";

  if (!email || !code) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_fields",
        message: "E-posta ve doğrulama kodu zorunludur.",
      },
      { status: 400 },
    );
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_code_format",
        message: "Doğrulama kodu 6 haneli bir sayı olmalıdır.",
      },
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

  // Find user by email
  let user;
  try {
    user = await findUserByEmail(adminClient, email);
  } catch (err) {
    console.error(`${ROUTE_TAG} User lookup error.`, err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "Kullanıcı aranırken bir hata oluştu." },
      { status: 500 },
    );
  }

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "user_not_found",
        message: "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı.",
      },
      { status: 404 },
    );
  }

  // Already verified
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

  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const verification = userMeta.verification as VerificationMetadata | undefined;

  if (!verification?.code_hash || !verification?.expires_at) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_code",
        message: "Doğrulama kodu bulunamadı. Lütfen yeni kod isteyin.",
      },
      { status: 400 },
    );
  }

  // Brute force check
  const attempts = verification.attempts ?? 0;
  if (isMaxAttemptsReached(attempts)) {
    return NextResponse.json(
      {
        ok: false,
        error: "max_attempts",
        message:
          "Çok fazla hatalı deneme yapıldı. Lütfen yeni bir doğrulama kodu isteyin.",
      },
      { status: 429 },
    );
  }

  // Expiry check
  if (isCodeExpired(verification.expires_at)) {
    return NextResponse.json(
      {
        ok: false,
        error: "code_expired",
        message: "Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin.",
      },
      { status: 400 },
    );
  }

  // Hash & compare
  const inputHash = await hashVerificationCode(code);
  if (inputHash !== verification.code_hash) {
    // Increment attempt counter
    const newAttempts = attempts + 1;
    await adminClient.auth.admin
      .updateUserById(user.id, {
        user_metadata: {
          ...userMeta,
          verification: { ...verification, attempts: newAttempts },
        },
      })
      .catch((err) =>
        console.error(`${ROUTE_TAG} Failed to increment attempts.`, err),
      );

    const remaining = MAX_VERIFICATION_ATTEMPTS - newAttempts;
    const message =
      remaining > 0
        ? `Doğrulama kodu hatalı. ${remaining} deneme hakkınız kaldı.`
        : "Çok fazla hatalı deneme yapıldı. Lütfen yeni bir doğrulama kodu isteyin.";

    console.log("VERIFY_CODE_FAILED", {
      email,
      userId: user.id,
      attempts: newAttempts,
    });

    return NextResponse.json(
      { ok: false, error: "invalid_code", message },
      { status: 400 },
    );
  }

  // Code valid → confirm email
  console.log("VERIFY_CODE_SUCCESS", { email, userId: user.id });

  const { error: confirmError } = await adminClient.auth.admin.updateUserById(
    user.id,
    {
      email_confirm: true,
      user_metadata: {
        ...userMeta,
        verification: null, // Clear code data
        email_status: "verified",
        email_verified_at: new Date().toISOString(),
      },
    },
  );

  if (confirmError) {
    console.error(`${ROUTE_TAG} Email confirm failed.`, confirmError);
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message:
          "E-posta doğrulama işlemi tamamlanamadı. Lütfen tekrar deneyin.",
      },
      { status: 500 },
    );
  }

  // Bootstrap user records (idempotent - same as /auth/callback)
  const legalConsents = userMeta.legal_consents as
    | Record<string, unknown>
    | undefined;
  const acceptedTerms = legalConsents
    ? Boolean(legalConsents.accepted_terms)
    : true;

  const bootstrapResult = await bootstrapUserRecords({
    userId: user.id,
    email,
    acceptedTerms,
  }).catch((err) => {
    console.error(`${ROUTE_TAG} Bootstrap failed (non-blocking).`, err);
    return { ok: false as const, error: String(err), stage: "unknown" };
  });

  if (!bootstrapResult.ok) {
    console.warn(`${ROUTE_TAG} Bootstrap warning.`, {
      userId: user.id,
      error: bootstrapResult.error,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "E-posta adresiniz başarıyla doğrulandı. Şimdi giriş yapabilirsiniz.",
  });
}
