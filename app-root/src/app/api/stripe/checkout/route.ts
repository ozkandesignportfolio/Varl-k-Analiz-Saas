import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { PREMIUM_MONTHLY_PRICE_KURUS } from "@/lib/plans/pricing";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import { getStripeClient } from "@/lib/services/stripe";
import { ensureProfileExists } from "@/lib/plans/profile-plan";
import type { DbClient } from "@/lib/repos/_shared";

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;

// ---------------------------------------------------------------------------
// Safe env helpers (never throw)
// ---------------------------------------------------------------------------

const envStr = (key: string): string | null => {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : null;
};

// Stripe price id'si merkezi schema'da yok (opsiyonel operasyonel flag). Bunu
// CONFIG'e taşımak isteyen biri schema'yı genişletir.
const readPremiumPriceId = (): string | null =>
  envStr("STRIPE_PRICE_PREMIUM") || envStr("STRIPE_PRICE_PREMIUM_MONTHLY");

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

// ---------------------------------------------------------------------------
// Error helpers — structured, never throw
// ---------------------------------------------------------------------------

const isStripeError = (
  e: unknown,
): e is { type: string; code?: string; param?: string; statusCode?: number; message: string } => {
  if (e == null || typeof e !== "object") return false;
  return "type" in e && "message" in e;
};

/**
 * Structured error shape returned by every non-200 path.
 *   { error: "stripe_checkout_failed", stage, code, message, ?stripe, ?debug }
 */
const safeErrorJson = (
  status: number,
  stage: string,
  message: string,
  opts?: {
    code?: string | null;
    stripe?: Record<string, unknown> | null;
    debug?: Record<string, unknown>;
  },
) =>
  NextResponse.json(
    {
      error: "stripe_checkout_failed",
      stage,
      code: opts?.code ?? null,
      message,
      ...(opts?.stripe ? { stripe: opts.stripe } : {}),
      ...(process.env.NODE_ENV !== "production" && opts?.debug
        ? { debug: opts.debug }
        : {}),
    },
    { status },
  );

/** Log via API logger, then return structured JSON error. Never throws. */
const logAndRespond = (
  error: unknown,
  stage: string,
  status: number,
  userId?: string,
  meta?: Record<string, unknown>,
) => {
  const se = isStripeError(error) ? error : null;
  const raw = error instanceof Error ? error.message : String(error);

  try {
    logApiError({
      route: "/api/stripe/checkout",
      method: "POST",
      status,
      error,
      message: `Stripe checkout failed at stage: ${stage}`,
      userId: userId ?? null,
      meta: { stage, message: raw, stripeCode: se?.code ?? null, ...meta },
    });
  } catch {
    console.error("[stripe/checkout] logApiError threw during", stage, ":", raw);
  }

  const safeMsg =
    process.env.NODE_ENV === "production"
      ? `Checkout başlatılamadı (${stage}).`
      : raw;

  return safeErrorJson(status, stage, safeMsg, {
    code: se?.code,
    stripe: se
      ? { type: se.type, code: se.code, param: se.param, statusCode: se.statusCode }
      : null,
    debug: meta,
  });
};

/** Map every known Stripe error type to the correct HTTP status. */
const STRIPE_ERROR_STATUS: Record<string, number> = {
  authentication_error: 401,
  invalid_request_error: 400,
  rate_limit_error: 429,
  api_connection_error: 502,
  api_error: 502,
  card_error: 400,
  idempotency_error: 409,
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let currentStage = "init";
  let userId: string | undefined;

  try {
    // --- Stage: rate-limit ---
    currentStage = "rate-limit";
    const requestIp =
      (request as Request & { ip?: string }).ip ??
      getRequestIp(request) ??
      "anon";
    const rl = enforceRateLimit({
      scope: "api",
      key: requestIp,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return safeErrorJson(429, currentStage, "Çok fazla istek gönderildi.");
    }

    // --- Stage: auth ---
    currentStage = "auth";
    const auth = (await requireRouteUser(request)) as
      | { user: { id: string; email?: string | null }; response?: never }
      | { response: unknown; user?: never };
    if ("response" in auth) {
      return safeErrorJson(401, currentStage, "Oturum açmanız gerekiyor.", {
        code: "auth_required",
      });
    }

    const { user } = auth;
    userId = user.id;

    // --- Diagnostic: env state (non-production only to avoid log noise) ---
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[stripe/checkout] ENV_DIAG:",
        JSON.stringify({
          keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 8) ?? "MISSING",
          keyLength: process.env.STRIPE_SECRET_KEY?.length ?? 0,
          priceEnv: process.env.STRIPE_PRICE_PREMIUM
            ? `${process.env.STRIPE_PRICE_PREMIUM.substring(0, 16)}...`
            : "MISSING",
          priceMonthlyEnv: process.env.STRIPE_PRICE_PREMIUM_MONTHLY
            ? "SET"
            : "MISSING",
          appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "MISSING",
          nodeEnv: process.env.NODE_ENV ?? "UNSET",
          userId: user.id,
        }),
      );
    }

    // --- Stage: profile-fetch ---
    currentStage = "profile-fetch";
    let adminClient: ReturnType<typeof getSupabaseAdmin>;
    try {
      adminClient = getSupabaseAdmin();
    } catch (error) {
      return safeErrorJson(500, currentStage, "Veritabanı bağlantısı kurulamadı.", {
        code: "admin_client_init_failed",
        debug: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[stripe/checkout] PROFILE_QUERY_FAILED:", {
        userId: user.id,
        errorMessage: (profileError as { message?: string }).message ?? String(profileError),
        errorCode: (profileError as { code?: string }).code ?? null,
      });
      return safeErrorJson(500, currentStage, "Profil sorgusu başarısız.", {
        code: "profile_query_failed",
        debug: {
          errorMessage: (profileError as { message?: string }).message ?? String(profileError),
          errorCode: (profileError as { code?: string }).code ?? null,
        },
      });
    }

    // Lazy-create: if profile row does not exist, upsert a default one
    if (!profile) {
      currentStage = "profile-create";
      const adminDbClient = adminClient as unknown as DbClient;
      const { error: upsertError } = await ensureProfileExists(adminDbClient, user.id);

      if (upsertError) {
        console.error("[stripe/checkout] PROFILE_CREATE_FAILED:", {
          userId: user.id,
          error: upsertError,
        });
        return safeErrorJson(500, currentStage, "Profil oluşturulamadı.", {
          code: "profile_create_failed",
          debug: { errorMessage: upsertError },
        });
      }

      // Re-fetch to confirm creation
      const { data: newProfile, error: refetchError } = await adminClient
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (refetchError || !newProfile) {
        console.error("[stripe/checkout] PROFILE_MISSING_AFTER_CREATE:", {
          userId: user.id,
          refetchError: refetchError
            ? (refetchError as { message?: string }).message ?? String(refetchError)
            : "no row after upsert",
        });
        return safeErrorJson(500, "profile-fetch", "Profil oluşturuldu ancak doğrulanamadı.", {
          code: "profile_missing",
          debug: {
            errorMessage: refetchError
              ? ((refetchError as { message?: string }).message ?? String(refetchError))
              : "no row after upsert",
          },
        });
      }

      if (newProfile.plan === "premium") {
        return safeErrorJson(
          409,
          "profile-check",
          "Zaten premium üyeliğiniz aktif.",
        );
      }
    }

    if (profile?.plan === "premium") {
      return safeErrorJson(
        409,
        "profile-check",
        "Zaten premium üyeliğiniz aktif.",
      );
    }

    // --- Stage: env-validation ---
    currentStage = "env-validation";
    const priceId = readPremiumPriceId();
    if (!priceId) {
      return logAndRespond(
        new Error("Missing STRIPE_PRICE_PREMIUM"),
        currentStage,
        500,
        userId,
        {
          STRIPE_PRICE_PREMIUM: process.env.STRIPE_PRICE_PREMIUM
            ? "SET"
            : "MISSING",
          STRIPE_PRICE_PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY
            ? "SET"
            : "MISSING",
        },
      );
    }

    if (!priceId.startsWith("price_")) {
      return safeErrorJson(
        400,
        currentStage,
        `STRIPE_PRICE_PREMIUM value must start with "price_", got: "${priceId.substring(0, 16)}..."`,
        {
          code: "invalid_price_format",
          debug: { priceId: priceId.substring(0, 20) },
        },
      );
    }

    // --- Stage: stripe-init ---
    currentStage = "stripe-init";
    let stripeClient: Stripe;
    try {
      stripeClient = getStripeClient();
    } catch (error) {
      return logAndRespond(error, currentStage, 500, userId, {
        hasStripeKey: Boolean(process.env.STRIPE_SECRET_KEY),
        keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 7) ?? "MISSING",
      });
    }

    // --- Stage: app-url ---
    currentStage = "app-url";
    let appUrl: string;
    try {
      const raw = process.env.NEXT_PUBLIC_APP_URL;
      if (!raw) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
      appUrl = new URL(raw).origin;
    } catch (error) {
      return logAndRespond(error, currentStage, 500, userId);
    }

    // --- Stage: price-validation ---
    currentStage = "price-validation";
    const keyPrefix =
      process.env.STRIPE_SECRET_KEY?.substring(0, 8) ?? "MISSING";
    const keyIsLive = keyPrefix.startsWith("sk_live");
    let checkoutMode: "subscription" | "payment" = "subscription";
    let priceType: string = "unknown";
    try {
      const stripePrice = await stripeClient.prices.retrieve(priceId);
      priceType = stripePrice.type;
      checkoutMode =
        stripePrice.type === "recurring" ? "subscription" : "payment";

      if (!stripePrice.active) {
        return safeErrorJson(
          400,
          currentStage,
          `Stripe price "${priceId}" is not active.`,
          { code: "price_inactive" },
        );
      }

      // Guard: key mode must match price mode
      if (keyIsLive !== stripePrice.livemode) {
        const modeLabel = keyIsLive ? "LIVE" : "TEST";
        const priceModeLabel = stripePrice.livemode ? "LIVE" : "TEST";
        const msg =
          `INVALID_STRIPE_PRICE_ENV: key is ${modeLabel} but price "${priceId}" belongs to ${priceModeLabel} mode. ` +
          `Update STRIPE_PRICE_PREMIUM to a ${modeLabel} price from your Stripe dashboard.`;
        console.error("[stripe/checkout] MODE MISMATCH:", msg);
        return safeErrorJson(400, currentStage, msg, {
          code: "price_mode_mismatch",
          debug: { keyPrefix, priceId, keyIsLive, priceLivemode: stripePrice.livemode },
        });
      }

      // All price validations passed — log structured summary
      console.log(
        "[stripe/checkout] PRICE_VALIDATED:",
        JSON.stringify({
          priceId,
          priceType,
          priceActive: stripePrice.active,
          priceLivemode: stripePrice.livemode,
          priceCurrency: stripePrice.currency,
          priceUnitAmount: stripePrice.unit_amount,
          keyPrefix,
          keyIsLive,
          checkoutMode,
        }),
      );
    } catch (error) {
      const se = isStripeError(error) ? error : null;

      // Permanent guard: price does not exist in this Stripe environment
      if (se?.code === "resource_missing" || se?.statusCode === 404) {
        const modeLabel = keyIsLive ? "LIVE" : "TEST";
        const msg =
          `INVALID_STRIPE_PRICE_ENV: price "${priceId}" does not exist in this Stripe ${modeLabel} environment. ` +
          `Verify STRIPE_PRICE_PREMIUM matches a valid price_* ID from your Stripe dashboard (${modeLabel} mode).`;
        console.error("[stripe/checkout] PRICE NOT FOUND:", JSON.stringify({ priceId, keyPrefix, modeLabel }));
        return safeErrorJson(400, currentStage, msg, {
          code: "resource_missing",
          stripe: se ? { type: se.type, code: se.code, param: se.param, statusCode: se.statusCode } : null,
          debug: { priceId, keyPrefix, keyIsLive },
        });
      }

      return logAndRespond(error, currentStage, 500, userId, { priceId, keyPrefix });
    }

    // --- Stage: pre-validation ---
    currentStage = "pre-validation";
    const premiumLineItem = resolvePremiumCheckoutLineItem(priceId);
    const successUrl = `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${appUrl}/billing/cancel`;
    const isProduction = process.env.NODE_ENV === "production";

    if (!premiumLineItem.price && !premiumLineItem.price_data) {
      return safeErrorJson(
        400,
        currentStage,
        "Line item has neither price nor price_data",
        { code: "invalid_line_item" },
      );
    }

    if (!premiumLineItem.quantity || premiumLineItem.quantity <= 0) {
      return safeErrorJson(400, currentStage, "Line item quantity must be > 0", {
        code: "invalid_quantity",
      });
    }

    try {
      new URL(successUrl);
      new URL(cancelUrl);
    } catch {
      return safeErrorJson(
        400,
        currentStage,
        "success_url or cancel_url is not a valid URL",
        { code: "invalid_url" },
      );
    }

    if (isProduction) {
      if (
        !successUrl.startsWith("https://") ||
        !cancelUrl.startsWith("https://")
      ) {
        return safeErrorJson(
          400,
          currentStage,
          "URLs must use HTTPS in production",
          { code: "url_not_https" },
        );
      }
      const su = new URL(successUrl);
      if (su.hostname === "localhost" || su.hostname === "127.0.0.1") {
        return safeErrorJson(
          400,
          currentStage,
          "URLs must not point to localhost in production",
          { code: "url_localhost" },
        );
      }
    }

    if (isProduction && keyPrefix.startsWith("sk_test")) {
      return safeErrorJson(
        400,
        currentStage,
        "Stripe test key detected in production environment",
        { code: "test_key_in_prod" },
      );
    }

    // --- Stage: session-create ---
    currentStage = "session-create";
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

    console.log(
      "[stripe/checkout] PRE-CREATE DEBUG:",
      JSON.stringify({
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
      }),
    );

    try {
      const session =
        await stripeClient.checkout.sessions.create(createParams);

      if (!session.url) {
        return logAndRespond(
          new Error("Stripe returned session without URL"),
          "session-url-missing",
          500,
          userId,
          { sessionId: session.id, sessionStatus: session.status },
        );
      }

      console.log("[stripe/checkout] SUCCESS sessionId=", session.id);
      return NextResponse.json({ url: session.url }, { status: 200 });
    } catch (error) {
      const se = isStripeError(error) ? error : null;
      const errMsg = error instanceof Error ? error.message : String(error);
      const stripeInfo = se
        ? {
            type: se.type,
            code: se.code,
            param: se.param,
            statusCode: se.statusCode,
          }
        : null;

      console.error(
        "[stripe/checkout] SESSION CREATE FAILED:",
        JSON.stringify({
          message: errMsg,
          ...stripeInfo,
          keyPrefix,
          priceId,
          appUrl,
        }),
      );

      // resource_missing gets its own message regardless of type
      if (se?.code === "resource_missing" || se?.statusCode === 404) {
        const msg =
          process.env.NODE_ENV === "production"
            ? `Checkout başlatılamadı (${currentStage}).`
            : `Stripe price "${priceId}" not found. Verify STRIPE_PRICE_PREMIUM matches your Stripe dashboard.`;

        return safeErrorJson(400, currentStage, msg, {
          code: "resource_missing",
          stripe: stripeInfo,
        });
      }

      // All other Stripe errors → mapped HTTP status
      const httpStatus = se?.type
        ? (STRIPE_ERROR_STATUS[se.type] ?? 500)
        : 500;

      try {
        logApiError({
          route: "/api/stripe/checkout",
          method: "POST",
          status: httpStatus,
          error,
          message: `Stripe sessions.create failed: ${errMsg}`,
          userId: userId ?? null,
          meta: { stage: currentStage, ...stripeInfo, priceId, keyPrefix },
        });
      } catch {
        console.error("[stripe/checkout] logApiError threw:", errMsg);
      }

      const safeMsg =
        process.env.NODE_ENV === "production"
          ? `Checkout başlatılamadı (${currentStage}).`
          : errMsg;

      return safeErrorJson(httpStatus, currentStage, safeMsg, {
        code: se?.code,
        stripe: stripeInfo,
      });
    }
  } catch (outerError) {
    // ═══════ GLOBAL FALLBACK — nothing escapes as a bare 500 ═══════
    const msg =
      outerError instanceof Error ? outerError.message : String(outerError);

    console.error(
      "[stripe/checkout] UNHANDLED EXCEPTION:",
      JSON.stringify({
        stage: currentStage,
        message: msg,
        userId: userId ?? null,
      }),
    );

    try {
      logApiError({
        route: "/api/stripe/checkout",
        method: "POST",
        status: 500,
        error: outerError,
        message: `Unhandled exception at stage: ${currentStage}`,
        userId: userId ?? null,
        meta: { stage: currentStage },
      });
    } catch {
      // logging itself must never crash the response
    }

    return safeErrorJson(
      500,
      currentStage,
      process.env.NODE_ENV === "production"
        ? `Checkout başlatılamadı (${currentStage}).`
        : msg,
    );
  }
}
