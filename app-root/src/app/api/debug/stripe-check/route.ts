import "server-only";

import { NextResponse } from "next/server";
import { ServerEnv } from "@/lib/env/server-env";
import { getStripeClient } from "@/lib/services/stripe";
import { requireConfiguredAppOrigin } from "@/lib/config/app-url";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeEnv: ServerEnv.NODE_ENV,
  };

  // 1. STRIPE_SECRET_KEY
  try {
    const key = ServerEnv.STRIPE_SECRET_KEY;
    diagnostics.STRIPE_SECRET_KEY = key
      ? `${key.substring(0, 8)}...${key.substring(key.length - 4)} (${key.length} chars)`
      : "MISSING";
  } catch (e) {
    diagnostics.STRIPE_SECRET_KEY = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. STRIPE_PRICE_PREMIUM
  try {
    diagnostics.STRIPE_PRICE_PREMIUM = ServerEnv.STRIPE_PRICE_PREMIUM || "MISSING/EMPTY";
  } catch (e) {
    diagnostics.STRIPE_PRICE_PREMIUM = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. STRIPE_PRICE_PREMIUM_MONTHLY
  try {
    diagnostics.STRIPE_PRICE_PREMIUM_MONTHLY = ServerEnv.STRIPE_PRICE_PREMIUM_MONTHLY || "MISSING/EMPTY";
  } catch (e) {
    diagnostics.STRIPE_PRICE_PREMIUM_MONTHLY = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 4. APP_URL
  try {
    const appUrl = requireConfiguredAppOrigin();
    diagnostics.APP_URL = appUrl;
  } catch (e) {
    diagnostics.APP_URL = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. Stripe client init
  try {
    const client = getStripeClient();
    diagnostics.stripeClientInit = "OK";

    // 6. Validate price ID against Stripe API
    const priceId = ServerEnv.STRIPE_PRICE_PREMIUM || ServerEnv.STRIPE_PRICE_PREMIUM_MONTHLY;
    const keyStr = ServerEnv.STRIPE_SECRET_KEY;
    const keyIsLive = keyStr.startsWith("sk_live_");
    diagnostics.keyMode = keyIsLive ? "LIVE" : "TEST";

    if (priceId) {
      try {
        const price = await client.prices.retrieve(priceId);
        const modeMismatch = keyIsLive !== price.livemode;
        diagnostics.stripePrice = {
          id: price.id,
          active: price.active,
          livemode: price.livemode,
          currency: price.currency,
          unit_amount: price.unit_amount,
          type: price.type,
          recurring: price.recurring
            ? { interval: price.recurring.interval, interval_count: price.recurring.interval_count }
            : null,
          product: typeof price.product === "string" ? price.product : "expanded",
        };
        diagnostics.modeMismatch = modeMismatch;
        if (modeMismatch) {
          diagnostics.modeMismatchDetail =
            `Key is ${keyIsLive ? "LIVE" : "TEST"} but price "${priceId}" is ${price.livemode ? "LIVE" : "TEST"}`;
        }
      } catch (e) {
        diagnostics.stripePrice = `THROW: ${e instanceof Error ? e.message : String(e)}`;
      }
    } else {
      diagnostics.stripePrice = "NO_PRICE_ID_TO_CHECK";
    }
  } catch (e) {
    diagnostics.stripeClientInit = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 7. SUPABASE_SERVICE_ROLE_KEY
  try {
    const key = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;
    diagnostics.SUPABASE_SERVICE_ROLE_KEY = key
      ? `${key.substring(0, 10)}... (${key.length} chars)`
      : "MISSING";
  } catch (e) {
    diagnostics.SUPABASE_SERVICE_ROLE_KEY = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
