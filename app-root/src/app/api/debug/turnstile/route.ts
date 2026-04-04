import { NextResponse } from "next/server";
import {
  getMaskedSiteKeyPreview,
  getTurnstileRequestContext,
} from "@/lib/auth/turnstile-diagnostics";
import { readTurnstileServerEnv } from "@/lib/env/turnstile-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getDebugSummary = (env: ReturnType<typeof readTurnstileServerEnv>) => {
  if (env.missing.length > 0) {
    if (env.secretKeyKind === "localhost_test" || env.siteKeyKind === "localhost_test") {
      return "key";
    }

    return "env";
  }

  return "unknown";
};

export async function GET(request: Request) {
  const env = readTurnstileServerEnv();
  const requestContext = getTurnstileRequestContext(request);

  return NextResponse.json({
    diagnosis: {
      likelyIssue: getDebugSummary(env),
      summary:
        env.missing.length > 0
          ? `Turnstile env/config issue detected: ${env.missing.join(", ")}`
          : "Turnstile env gorunuyor; domain teyidi icin /api/test-turnstile cagrisi yapin.",
    },
    headers: requestContext.headers,
    nodeEnv: env.nodeEnv,
    requestHostname: requestContext.requestHostname,
    turnstile: {
      missing: env.missing,
      productionUsesTestKeys: env.productionUsesTestKeys,
      secretKeyPresent: Boolean(env.secretKey),
      secretKeyKind: env.secretKeyKind,
      siteKeyKind: env.siteKeyKind,
      siteKeyPreview: getMaskedSiteKeyPreview(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    },
  });
}
