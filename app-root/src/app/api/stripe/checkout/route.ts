import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { PREMIUM_MONTHLY_PRICE_KURUS } from "@/lib/plans/pricing";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

type LineItem = {
  quantity: number;
  price?: string;
  price_data?: {
    currency: string;
    unit_amount: number;
    recurring: { interval: string; interval_count: number };
    product?: string;
    product_data?: { name: string };
  };
};

type StripeSession = { id: string; url: string | null; status: string | null };

type StripeClient = {
  checkout: { sessions: { create(p: unknown): Promise<StripeSession> } };
};

// Stripe price id'si merkezi schema'da yok (opsiyonel operasyonel flag). Bunu
// CONFIG'e taşımak isteyen biri schema'yı genişletir.
const readPremiumPriceId = (): string | null =>
  process.env.STRIPE_PRICE_PREMIUM ||
  process.env.STRIPE_PRICE_PREMIUM_MONTHLY ||
  null;

const PREMIUM_CHECKOUT_CURRENCY = "try";

const buildFallbackPremiumLineItem = (
  productId?: string,
): LineItem => ({
  quantity: 1,
  price_data: {
    currency: PREMIUM_CHECKOUT_CURRENCY,
    unit_amount: PREMIUM_MONTHLY_PRICE_KURUS,
    recurring: {
      interval: "month",
      interval_count: 1,
    },
    ...(productId
      ? { product: productId }
      : {
          product_data: {
            name: "Assetly Premium",
          },
        }),
  },
});

const resolvePremiumCheckoutLineItem = (
  configuredPriceId: string | undefined,
): LineItem => {
  if (configuredPriceId) {
    return { price: configuredPriceId, quantity: 1 };
  }
  return buildFallbackPremiumLineItem();
};

const isStripeError = (
  e: unknown,
): e is { type: string; code?: string; message: string } => {
  if (e == null || typeof e !== "object") return false;
  return "type" in e && "message" in e;
};

const buildErrorResponse = (
  error: unknown,
  stage: string,
  userId?: string,
  meta?: Record<string, unknown>,
) => {
  const se = isStripeError(error) ? error : null;
  const stripeMessage = se?.message ?? null;
  const stripeCode = se?.code ?? null;
  const devMessage = error instanceof Error ? error.message : String(error);

  logApiError({
    route: "/api/stripe/checkout",
    method: "POST",
    status: 500,
    error,
    message: `Stripe checkout failed at stage: ${stage}`,
    userId: userId ?? null,
    meta: {
      stage,
      message: devMessage,
      stripeCode,
      ...meta,
    },
  });

  const clientMessage =
    process.env.NODE_ENV === "production"
      ? `Checkout başlatılamadı (${stage}).`
      : stripeMessage || devMessage || `Checkout başlatılamadı (${stage}).`;

  return NextResponse.json({ error: clientMessage }, { status: 500 });
};

export async function POST(request: Request) {
  const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
  const rl = enforceRateLimit({
    scope: "api",
    key: requestIp,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  const auth = (await requireRouteUser(request)) as
    | { user: { id: string; email?: string | null }; response?: never }
    | { response: unknown; user?: never };
  if ("response" in auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = auth;

  // --- Stage: profile-check ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adminClient: any;
  try {
    adminClient = getSupabaseAdmin();
  } catch (error) {
    return buildErrorResponse(error, "supabase-admin-init", user.id);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return buildErrorResponse(profileError, "profile-fetch", user.id);
  }

  if (profile?.plan === "premium") {
    return NextResponse.json(
      { error: "Zaten premium üyeliğiniz aktif." },
      { status: 409 },
    );
  }

  // --- Stage: env-validation ---
  const priceId = readPremiumPriceId();
  if (!priceId) {
    logApiError({
      route: "/api/stripe/checkout",
      method: "POST",
      status: 500,
      error: new Error("Missing STRIPE_PRICE_PREMIUM"),
      message: "Stripe price env variable is not configured.",
      userId: user.id,
      meta: {
        STRIPE_PRICE_PREMIUM: process.env.STRIPE_PRICE_PREMIUM ? "SET" : "MISSING",
        STRIPE_PRICE_PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ? "SET" : "MISSING",
      },
    });
    return NextResponse.json(
      { error: "Ödeme yapılandırması eksik. Lütfen yöneticiyle iletişime geçin." },
      { status: 500 },
    );
  }

  // --- Stage: stripe-init ---
  let stripeClient: StripeClient;
  try {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!) as unknown as StripeClient;
  } catch (error) {
    return buildErrorResponse(error, "stripe-init", user.id, {
      hasStripeKey: Boolean(process.env.STRIPE_SECRET_KEY),
      keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) ?? "MISSING",
    });
  }

  // --- Stage: app-url ---
  let appUrl: string;
  try {
    const raw = process.env.NEXT_PUBLIC_APP_URL;
    if (!raw) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
    appUrl = new URL(raw).origin;
  } catch (error) {
    return buildErrorResponse(error, "app-url", user.id);
  }

  // --- Stage: session-create ---
  try {
    const premiumLineItem = resolvePremiumCheckoutLineItem(priceId);

    console.log("[stripe/checkout] DEBUG session-create attempt:", JSON.stringify({
      priceId,
      lineItem: premiumLineItem,
      appUrl,
      userEmail: user.email ?? "null",
      unitAmount: PREMIUM_MONTHLY_PRICE_KURUS,
      userId: user.id,
    }));

    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      line_items: [premiumLineItem],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        userId: user.id,
        premiumPriceTl: String(PREMIUM_MONTHLY_PRICE_KURUS / 100),
      },
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
    });

    if (!session.url) {
      return buildErrorResponse(
        new Error("Stripe returned session without URL"),
        "session-url-missing",
        user.id,
        { sessionId: session.id, sessionStatus: session.status },
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    return buildErrorResponse(error, "session-create", user.id, {
      priceId,
      unitAmount: PREMIUM_MONTHLY_PRICE_KURUS,
      appUrl,
    });
  }
}
