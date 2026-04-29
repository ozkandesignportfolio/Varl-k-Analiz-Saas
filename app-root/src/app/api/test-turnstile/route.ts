import "server-only";

import { NextResponse } from "next/server";
import {
  TURNSTILE_TEST_TOKEN,
  getMaskedSiteKeyPreview,
  getTurnstileRequestContext,
} from "@/lib/auth/turnstile-diagnostics";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";
import { PublicEnv } from "@/lib/env/public-env";
import { readTurnstileServerEnv } from "@/lib/env/turnstile-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buildSummary = (verification: Awaited<ReturnType<typeof verifyTurnstileToken>>) => {
  if (verification.hostnameMismatch || verification.issue === "domain") {
    return "Domain mismatch tespit edildi. Cloudflare hostname ile request hostname aynı değil.";
  }

  if (verification.errorCodes.includes("invalid-input-secret") || verification.issue === "key") {
    return "Turnstile secret key geçersiz veya yanlış ortam anahtarı kullanıyor.";
  }

  if (verification.errorCodes.includes("invalid-input-response") || verification.issue === "token") {
    return "Secret key ulaşılıyor; sabit test token bu key ile doğrulanmadı.";
  }

  if (verification.issue === "env") {
    return "Turnstile env eksik veya geçersiz.";
  }

  if (verification.issue === "network") {
    return "Cloudflare verify isteği tamamlanamadı.";
  }

  if (verification.ok) {
    return "Turnstile verify çağrısı başarılı.";
  }

  return "Turnstile verify sonucu belirsiz; logları kontrol edin.";
};

const handleRequest = async (request: Request) => {
  const env = readTurnstileServerEnv();
  const requestContext = getTurnstileRequestContext(request);
  const verification = await verifyTurnstileToken({
    requestHost: requestContext.requestHostname,
    token: TURNSTILE_TEST_TOKEN,
  });

  return NextResponse.json({
    diagnosis: {
      likelyIssue: verification.issue,
      summary: buildSummary(verification),
    },
    request: {
      ...requestContext.headers,
      hostname: requestContext.requestHostname,
    },
    testToken: TURNSTILE_TEST_TOKEN,
    turnstile: {
      errorCodes: verification.errorCodes,
      hostname: verification.hostname,
      hostnameMismatch: verification.hostnameMismatch,
      issue: verification.issue,
      ok: verification.ok,
      reason: verification.ok ? null : verification.reason,
      requestHostname: verification.requestHostname,
    },
    turnstileEnv: {
      missing: env.missing,
      productionUsesTestKeys: env.productionUsesTestKeys,
      secretKeyPresent: Boolean(env.secretKey),
      secretKeyKind: env.secretKeyKind,
      siteKeyKind: env.siteKeyKind,
      siteKeyPreview: getMaskedSiteKeyPreview(PublicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    },
  });
};

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}
