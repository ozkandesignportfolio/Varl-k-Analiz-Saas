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

const executeWebhookBusinessLogic = async (event: Stripe.Event, supabaseAdmin: SupabaseClient): Promise<void> => {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const stripeCustomerId = toStripeId(session.customer);
    const stripeSubscriptionId = toStripeId(session.subscription);

    if (!userId) {
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
        return;
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plan: "premium",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
      })
      .eq("id", userId);

    if (error) {
      logApiError({
        route: "/api/stripe/webhook",
        method: "POST",
        status: 500,
        error,
        message: "Failed to update profile from Stripe webhook.",
      });
    }
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
    return NextResponse.json({ error: "Gecersiz Stripe imzasi." }, { status: 400 });
  }

  const idempotency = await withWebhookIdempotency(supabaseAdmin, event.id);
  if (!idempotency.proceed) {
    return idempotency.response;
  }

  return withRetrySafeExecution(async () => {
    await executeWebhookBusinessLogic(event, supabaseAdmin);
  });
}
