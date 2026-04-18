import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/services/stripe";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

export const runtime = "nodejs";

const toStripeId = (value: string | Stripe.Customer | Stripe.Subscription | Stripe.DeletedCustomer | null) => {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
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

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logApiError({
      route: "/api/stripe/webhook",
      method: "POST",
      status: 500,
      error: new Error("Missing STRIPE_WEBHOOK_SECRET"),
      message: "Stripe webhook secret missing.",
    });
    return NextResponse.json({ error: "Webhook secret missing." }, { status: 500 });
  }

  // getStripeClient() ve getSupabaseAdmin() CONFIG zinciri üzerinden
  // ilk çağrıda doğrulanır; env geçersizse throw eder ve global error handler
  // 500 döner (deterministik). Route içinde ayrıca guard gerekmez.
  const stripeClient = getStripeClient();
  const supabaseAdmin = getSupabaseAdmin();

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Gecersiz Stripe imzasi." }, { status: 400 });
  }

  const eventId = event.id;
  const { error: insertEventError } = await supabaseAdmin.from("stripe_webhook_events").insert({ id: eventId });

  if (insertEventError) {
    const isDuplicateInsert =
      insertEventError.code === "23505" || insertEventError.message?.toLowerCase().includes("duplicate key");

    if (isDuplicateInsert) {
      return NextResponse.json({ received: true, deduped: true }, { status: 200 });
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
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const stripeCustomerId = toStripeId(session.customer);
      const stripeSubscriptionId = toStripeId(session.subscription);

      if (!userId) {
        return NextResponse.json({ received: true }, { status: 200 });
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
          return NextResponse.json({ received: true }, { status: 200 });
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
  } catch (error) {
    logApiError({
      route: "/api/stripe/webhook",
      method: "POST",
      status: 400,
      error,
      message: "Stripe webhook processing failed.",
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
