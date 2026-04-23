import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { PREMIUM_MONTHLY_PRICE_KURUS } from "@/lib/plans/pricing";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import { getStripeClient } from "@/lib/services/stripe";
import { ServerEnv } from "@/lib/env/server-env";

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;

// Stripe price id'si merkezi schema'da yok (opsiyonel operasyonel flag). Bunu
// CONFIG'e taşımak isteyen biri schema'yı genişletir.
const readPremiumPriceId = (): string | null =>
  ServerEnv.STRIPE_PRICE_PREMIUM ||
  ServerEnv.STRIPE_PRICE_PREMIUM_MONTHLY ||
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
    product_data: productId ? undefined : { name: "Assetly Premium" },
    ...(productId ? { product: productId } : {}),
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
): e is { type: string; code?: string; param?: string; statusCode?: number; message: string } => {
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

  // --- Diagnostic: log raw env state before any Stripe stage ---
  console.log("[stripe/checkout] ENV_DIAG:", JSON.stringify({
    keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 8) ?? "MISSING",
    keyLength: process.env.STRIPE_SECRET_KEY?.length ?? 0,
    priceEnv: process.env.STRIPE_PRICE_PREMIUM ? `${process.env.STRIPE_PRICE_PREMIUM.substring(0, 16)}...` : "MISSING",
    priceMonthlyEnv: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ? "SET" : "MISSING",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "MISSING",
    nodeEnv: process.env.NODE_ENV ?? "UNSET",
    userId: user.id,
  }));

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
  let stripeClient: Stripe;
  try {
    stripeClient = getStripeClient();
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

  // --- Stage: price-validation ---
  let checkoutMode: "subscription" | "payment" = "subscription";
  let priceType: string = "unknown";
  try {
    const stripePrice = await stripeClient.prices.retrieve(priceId);
    priceType = stripePrice.type;
    checkoutMode = stripePrice.type === "recurring" ? "subscription" : "payment";

    if (!stripePrice.active) {
      console.error("[stripe/checkout] PRICE NOT ACTIVE:", priceId);
      return NextResponse.json(
        { error: "stripe-price-inactive", message: `Stripe price "${priceId}" is not active. Enable it in your Stripe dashboard.` },
        { status: 400 },
      );
    }
  } catch (error) {
    return buildErrorResponse(error, "price-validation", user.id, {
      priceId,
    });
  }

  // --- Stage: pre-validation ---
  const premiumLineItem = resolvePremiumCheckoutLineItem(priceId);
  const successUrl = `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${appUrl}/billing/cancel`;
  const keyPrefix = ServerEnv.STRIPE_SECRET_KEY?.substring(0, 8) ?? "MISSING";
  const isProduction = process.env.NODE_ENV === "production";

  // Price ID format check
  if (!priceId.startsWith("price_")) {
    console.error("[stripe/checkout] INVALID PRICE ID format:", priceId.substring(0, 12));
    return NextResponse.json(
      { error: "invalid-checkout-input", stage: "pre-validation", message: `STRIPE_PRICE_PREMIUM must start with "price_", got: "${priceId.substring(0, 12)}"`, debug: true },
      { status: 400 },
    );
  }

  // Line item integrity
  if (!premiumLineItem.price && !premiumLineItem.price_data) {
    console.error("[stripe/checkout] LINE ITEM missing price and price_data");
    return NextResponse.json(
      { error: "invalid-checkout-input", stage: "pre-validation", message: "Line item has neither price nor price_data", debug: true },
      { status: 400 },
    );
  }

  if (!premiumLineItem.quantity || premiumLineItem.quantity <= 0) {
    console.error("[stripe/checkout] LINE ITEM quantity invalid:", premiumLineItem.quantity);
    return NextResponse.json(
      { error: "invalid-checkout-input", stage: "pre-validation", message: "Line item quantity must be > 0", debug: true },
      { status: 400 },
    );
  }

  // URL validation
  try { new URL(successUrl); new URL(cancelUrl); } catch {
    console.error("[stripe/checkout] INVALID URLs:", { successUrl, cancelUrl });
    return NextResponse.json(
      { error: "invalid-checkout-input", stage: "pre-validation", message: "success_url or cancel_url is not a valid URL", debug: true },
      { status: 400 },
    );
  }

  if (isProduction) {
    if (!successUrl.startsWith("https://") || !cancelUrl.startsWith("https://")) {
      console.error("[stripe/checkout] URLs not HTTPS in production:", { successUrl, cancelUrl });
      return NextResponse.json(
        { error: "invalid-checkout-input", stage: "pre-validation", message: "URLs must use HTTPS in production", debug: true },
        { status: 400 },
      );
    }
    const su = new URL(successUrl);
    if (su.hostname === "localhost" || su.hostname === "127.0.0.1") {
      console.error("[stripe/checkout] localhost URL in production");
      return NextResponse.json(
        { error: "invalid-checkout-input", stage: "pre-validation", message: "URLs must not point to localhost in production", debug: true },
        { status: 400 },
      );
    }
  }

  // Key mismatch detection
  if (isProduction && keyPrefix.startsWith("sk_test")) {
    console.error("[stripe/checkout] TEST KEY used in production!");
    return NextResponse.json(
      { error: "invalid-checkout-input", stage: "pre-validation", message: "Stripe test key detected in production environment", debug: true },
      { status: 400 },
    );
  }

  // --- Stage: session-create ---
  const createParams: Stripe.Checkout.SessionCreateParams = {
    mode: checkoutMode,
    line_items: [premiumLineItem],
    client_reference_id: user.id,
    customer_email: user.email?.trim() || undefined,
    metadata: {
      userId: user.id,
      premiumPriceTl: String(PREMIUM_MONTHLY_PRICE_KURUS / 100),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  console.log("[stripe/checkout] PRE-CREATE DEBUG:", JSON.stringify({
    keyPrefix,
    priceId,
    priceType,
    checkoutMode,
    appUrl,
    successUrl,
    cancelUrl,
    userId: user.id,
    mode: createParams.mode,
    line_items: createParams.line_items,
    customer_email: createParams.customer_email ?? "null",
    unitAmount: PREMIUM_MONTHLY_PRICE_KURUS,
  }));

  try {
    const session = await stripeClient.checkout.sessions.create(createParams);

    if (!session.url) {
      console.error("[stripe/checkout] session created but NO URL:", { id: session.id, status: session.status });
      return buildErrorResponse(
        new Error("Stripe returned session without URL"),
        "session-url-missing",
        user.id,
        { sessionId: session.id, sessionStatus: session.status },
      );
    }

    console.log("[stripe/checkout] SUCCESS sessionId=", session.id);
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    const se = isStripeError(error) ? error : null;
    const errMsg = error instanceof Error ? error.message : String(error);

    console.error("[stripe/checkout] SESSION CREATE FAILED:", JSON.stringify({
      message: errMsg,
      type: se?.type ?? null,
      code: se?.code ?? null,
      param: se?.param ?? null,
      statusCode: se?.statusCode ?? null,
      keyPrefix,
      priceId,
      appUrl,
    }));

    // Specific: price not found
    if (se?.code === "resource_missing" || se?.statusCode === 404) {
      return NextResponse.json(
        {
          error: "stripe-session-create-failed",
          message: `Stripe price "${priceId}" not found. Verify STRIPE_PRICE_PREMIUM env matches your Stripe dashboard.`,
          stripe: { type: se?.type, code: se?.code, param: se?.param },
          debug: true,
        },
        { status: 400 },
      );
    }

    // Specific: auth / key error
    if (se?.type === "authentication_error") {
      return NextResponse.json(
        {
          error: "stripe-session-create-failed",
          message: "Stripe API key is invalid or has insufficient permissions.",
          stripe: { type: se.type, code: se.code },
          debug: true,
        },
        { status: 400 },
      );
    }

    // Specific: invalid request params
    if (se?.type === "invalid_request_error") {
      return NextResponse.json(
        {
          error: "stripe-session-create-failed",
          message: errMsg,
          stripe: { type: se.type, code: se.code, param: se.param },
          debug: true,
        },
        { status: 400 },
      );
    }

    // Generic fallback
    return NextResponse.json(
      {
        error: "stripe-session-create-failed",
        message: errMsg,
        stripe: se ? { type: se.type, code: se.code, param: se.param } : null,
        debug: true,
      },
      { status: 500 },
    );
  }
}
