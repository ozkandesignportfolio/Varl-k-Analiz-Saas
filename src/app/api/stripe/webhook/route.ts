import { NextResponse } from "next/server";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import Stripe from "stripe";
import { getStripeSecretKeyValidationError, stripe } from "@/lib/stripe";

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

  const stripeKeyError = getStripeSecretKeyValidationError();
  if (stripeKeyError) {
    return NextResponse.json({ error: stripeKeyError }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json({ error: "Webhook secret missing." }, { status: 500 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Gecersiz Stripe imzasi." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing Supabase admin env vars for Stripe webhook dedupe. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
    return NextResponse.json({ error: "Supabase admin configuration missing." }, { status: 500 });
  }

  let supabaseAdmin: (typeof import("@/lib/supabase-admin"))["supabaseAdmin"];

  try {
    ({ supabaseAdmin } = await import("@/lib/supabase-admin"));
  } catch (error) {
    console.error("Failed to initialize Supabase admin client for Stripe webhook:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  const eventId = event.id;
  const { error: insertEventError } = await supabaseAdmin.from("stripe_webhook_events").insert({ id: eventId });

  if (insertEventError) {
    const isDuplicateInsert =
      insertEventError.code === "23505" || insertEventError.message?.toLowerCase().includes("duplicate key");

    if (isDuplicateInsert) {
      return NextResponse.json({ received: true, deduped: true }, { status: 200 });
    }

    console.error("Failed to persist Stripe webhook event id:", insertEventError);
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
        console.error("Failed to update profile from Stripe webhook:", error);
      }
    }
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
