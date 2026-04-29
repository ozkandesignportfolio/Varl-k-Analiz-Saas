import "server-only";

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/services/stripe";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";

export const runtime = "nodejs";

const toStripeId = (value: string | Stripe.Customer | Stripe.Subscription | Stripe.DeletedCustomer | null) => {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
};

type WebhookContext = {
  stripeClient: Stripe;
  supabaseAdmin: SupabaseClient;
  webhookSecret: string;
};

const getWebhookSecret = (): string => ServerEnv.STRIPE_WEBHOOK_SECRET;

const getWebhookContext = (): WebhookContext | null => {
  const webhookSecret = getWebhookSecret();

  try {
    return {
      stripeClient: getStripeClient(),
      supabaseAdmin: getSupabaseAdmin(),
      webhookSecret,
    };
  } catch (error) {
    logApiError({
      route: "/api/stripe/webhook",
      method: "POST",
      status: 500,
      error,
      message: "Stripe webhook dependencies are not configured.",
    });
    return null;
  }
};

const withWebhookIdempotency = async (
  supabaseAdmin: SupabaseClient,
  eventId: string,
): Promise<{ proceed: true } | { proceed: false; response: NextResponse }> => {
  const { error: insertEventError } = await supabaseAdmin.from("stripe_webhook_events").insert({ id: eventId });

  if (!insertEventError) {
    return { proceed: true };
  }

  const isDuplicateInsert =
    insertEventError.code === "23505" || insertEventError.message?.toLowerCase().includes("duplicate key");

  if (isDuplicateInsert) {
    return { proceed: false, response: NextResponse.json({ received: true, deduped: true }, { status: 200 }) };
  }

  logApiError({
    route: "/api/stripe/webhook",
    method: "POST",
    status: 500,
    error: insertEventError,
    message: "Failed to persist Stripe webhook event id.",
    meta: {
      code: insertEventError.code ?? null,
    },
  });

  return {
    proceed: false,
    response: NextResponse.json({ error: "Webhook processing failed." }, { status: 500 }),
  };
};

const resolveUserIdByCustomer = async (
  supabaseAdmin: SupabaseClient,
  stripeCustomerId: string | null,
): Promise<string | null> => {
  if (!stripeCustomerId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return data?.id ?? null;
};

const resolveUserIdBySubscription = async (
  supabaseAdmin: SupabaseClient,
  stripeSubscriptionId: string | null,
): Promise<string | null> => {
  if (!stripeSubscriptionId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  return data?.id ?? null;
};

const executeWebhookBusinessLogic = async (
  event: Stripe.Event,
  supabaseAdmin: SupabaseClient,
  stripeClient: Stripe,
): Promise<void> => {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
    const stripeCustomerId = toStripeId(session.customer);
    const stripeSubscriptionId = toStripeId(session.subscription);

    console.log("[stripe/webhook] checkout.session.completed:", JSON.stringify({
      sessionId: session.id,
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      paymentStatus: session.payment_status,
    }));

    if (!userId) {
      console.error("[stripe/webhook] checkout.session.completed: no userId found in metadata or client_reference_id", {
        sessionId: session.id,
      });
      return;
    }

    if (stripeSubscriptionId) {
      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from("profiles")
        .select("plan, stripe_subscription_id")
        .eq("id", userId)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      if (existingProfile?.plan === "premium" && existingProfile.stripe_subscription_id === stripeSubscriptionId) {
        console.log("[stripe/webhook] checkout.session.completed: profile already premium with same subscription, skipping", { userId, stripeSubscriptionId });
        return;
      }
    }

    let currentPeriodEnd: string | null = null;
    if (stripeSubscriptionId) {
      try {
        const sub = await stripeClient.subscriptions.retrieve(stripeSubscriptionId);
        const rawPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        currentPeriodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null;
      } catch (subErr) {
        console.warn("[stripe/webhook] checkout.session.completed: failed to retrieve subscription for period_end", {
          stripeSubscriptionId,
          error: subErr instanceof Error ? subErr.message : String(subErr),
        });
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "premium",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
      })
      .eq("id", userId);

    if (error) {
      logApiError({
        route: "/api/stripe/webhook",
        method: "POST",
        status: 500,
        error,
        message: "Failed to update profile from Stripe webhook.",
        meta: { sessionId: session.id, userId, stripeCustomerId, stripeSubscriptionId },
      });
    } else {
      console.log("[stripe/webhook] checkout.session.completed: profile updated to premium", { userId, stripeSubscriptionId, currentPeriodEnd });
    }
    return;
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const stripeSubscriptionId = subscription.id;
    const stripeCustomerId = toStripeId(subscription.customer);
    const userId =
      subscription.metadata?.userId ??
      (await resolveUserIdBySubscription(supabaseAdmin, stripeSubscriptionId)) ??
      (await resolveUserIdByCustomer(supabaseAdmin, stripeCustomerId));

    if (!userId) {
      console.warn("[stripe/webhook] subscription.updated: could not resolve userId", { stripeSubscriptionId });
      return;
    }

    const rawPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
    const currentPeriodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null;

    const isActive = subscription.status === "active" || subscription.status === "trialing";

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: isActive ? "premium" : "free",
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        stripe_current_period_end: currentPeriodEnd,
        stripe_subscription_id: stripeSubscriptionId,
      })
      .eq("id", userId);

    if (error) {
      logApiError({
        route: "/api/stripe/webhook",
        method: "POST",
        status: 500,
        error,
        message: "Failed to update profile from subscription.updated webhook.",
        meta: { stripeSubscriptionId, userId },
      });
    }
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const stripeSubscriptionId = subscription.id;
    const stripeCustomerId = toStripeId(subscription.customer);
    const userId =
      subscription.metadata?.userId ??
      (await resolveUserIdBySubscription(supabaseAdmin, stripeSubscriptionId)) ??
      (await resolveUserIdByCustomer(supabaseAdmin, stripeCustomerId));

    if (!userId) {
      console.warn("[stripe/webhook] subscription.deleted: could not resolve userId", { stripeSubscriptionId });
      return;
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "free",
        cancel_at_period_end: false,
        stripe_subscription_id: null,
        stripe_current_period_end: null,
      })
      .eq("id", userId);

    if (error) {
      logApiError({
        route: "/api/stripe/webhook",
        method: "POST",
        status: 500,
        error,
        message: "Failed to downgrade profile from subscription.deleted webhook.",
        meta: { stripeSubscriptionId, userId },
      });
    }
    return;
  }
};

const withRetrySafeExecution = async (execute: () => Promise<void>): Promise<NextResponse> => {
  try {
    await execute();
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/stripe/webhook",
      method: "POST",
      status: 400,
      error,
      message: "Stripe webhook processing failed.",
    });
    return NextResponse.json({ received: true, processed: false }, { status: 200 });
  }
};

export async function POST(request: Request) {
  const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
  const rl = enforceRateLimit({
    scope: "api",
    key: request.headers.get("stripe-signature") ?? requestIp,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const context = getWebhookContext();
  if (!context) {
    return NextResponse.json({ error: "Webhook secret missing." }, { status: 500 });
  }

  const { stripeClient, supabaseAdmin, webhookSecret } = context;

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Geçersiz Stripe imzası." }, { status: 400 });
  }

  // --- Structured event log for observability ---
  const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 8) ?? "MISSING";
  const keyIsLive = keyPrefix.startsWith("sk_live");
  console.log(
    "[stripe/webhook] EVENT_RECEIVED:",
    JSON.stringify({
      eventId: event.id,
      eventType: event.type,
      eventLivemode: event.livemode,
      keyPrefix,
      keyIsLive,
    }),
  );

  // Guard: event livemode must match key mode
  if (keyIsLive !== event.livemode) {
    const modeLabel = keyIsLive ? "LIVE" : "TEST";
    const eventModeLabel = event.livemode ? "LIVE" : "TEST";
    console.error(
      `[stripe/webhook] MODE MISMATCH: key is ${modeLabel} but event ${event.id} is ${eventModeLabel}`,
    );
    return NextResponse.json(
      { error: `Webhook event mode mismatch: key=${modeLabel}, event=${eventModeLabel}` },
      { status: 400 },
    );
  }

  const idempotency = await withWebhookIdempotency(supabaseAdmin, event.id);
  if (!idempotency.proceed) {
    return idempotency.response;
  }

  return withRetrySafeExecution(async () => {
    await executeWebhookBusinessLogic(event, supabaseAdmin, stripeClient);
  });
}
