import Stripe from "stripe";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { PREMIUM_MONTHLY_PRICE_KURUS } from "@/lib/plans/pricing";
import { requireConfiguredAppOrigin } from "@/lib/config/app-url";
import { getStripeClient } from "@/lib/services/stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";

// Stripe price id'si merkezi schema'da yok (opsiyonel operasyonel flag). Bunu
// CONFIG'e taşımak isteyen biri schema'yı genişletir.
const readPremiumPriceId = (): string | null =>
  process.env.STRIPE_PRICE_PREMIUM?.trim() ||
  process.env.STRIPE_PRICE_PREMIUM_MONTHLY?.trim() ||
  null;

const PREMIUM_CHECKOUT_CURRENCY = "try";

const buildFallbackPremiumLineItem = (
  productId?: string,
): Stripe.Checkout.SessionCreateParams.LineItem => ({
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

const resolvePremiumCheckoutLineItem = async (
  configuredPriceId: string | undefined,
): Promise<Stripe.Checkout.SessionCreateParams.LineItem> => {
  if (!configuredPriceId) {
    return buildFallbackPremiumLineItem();
  }

  const stripeClient = getStripeClient();
  try {
    const configuredPrice = await stripeClient.prices.retrieve(configuredPriceId);
    const usesExpectedMonthlyPremiumPrice =
      configuredPrice.active &&
      configuredPrice.currency === PREMIUM_CHECKOUT_CURRENCY &&
      configuredPrice.unit_amount === PREMIUM_MONTHLY_PRICE_KURUS &&
      configuredPrice.recurring?.interval === "month" &&
      configuredPrice.recurring?.interval_count === 1;

    if (usesExpectedMonthlyPremiumPrice) {
      return {
        price: configuredPriceId,
        quantity: 1,
      };
    }

    const fallbackProductId =
      typeof configuredPrice.product === "string" && configuredPrice.product.trim().length > 0
        ? configuredPrice.product
        : undefined;

    return buildFallbackPremiumLineItem(fallbackProductId);
  } catch {
    return buildFallbackPremiumLineItem();
  }
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

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = auth;

  const priceId = readPremiumPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "Eksik ortam degiskenleri: STRIPE_PRICE_PREMIUM|STRIPE_PRICE_PREMIUM_MONTHLY" },
      { status: 500 },
    );
  }

  // getStripeClient() — CONFIG geçersizse buradan throw eder (runtime-env zinciri);
  // global error handler 500 döner. Ayrıca burada null-check gerekmez.
  const stripeClient = getStripeClient();
  let appUrl: string;
  try {
    appUrl = requireConfiguredAppOrigin();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "APP_URL or NEXT_PUBLIC_APP_URL is required" },
      { status: 500 },
    );
  }

  try {
    const premiumLineItem = await resolvePremiumCheckoutLineItem(priceId);
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
      return NextResponse.json({ error: "Checkout URL olusturulamadi." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/stripe/checkout",
      method: "POST",
      status: 500,
      error,
      message: "Stripe checkout session creation failed.",
      userId: user.id,
      meta: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: "Checkout oturumu baslatilamadi." }, { status: 500 });
  }
}
