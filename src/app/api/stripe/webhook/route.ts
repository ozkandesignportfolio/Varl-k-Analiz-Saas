import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeSecretKeyValidationError, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const toStripeId = (value: string | Stripe.Customer | Stripe.Subscription | Stripe.DeletedCustomer | null) => {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
};

export async function POST(request: Request) {
  const stripeKeyError = getStripeSecretKeyValidationError();
  if (stripeKeyError) {
    return NextResponse.json({ error: stripeKeyError }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const rawBody = await request.text();

  if (!stripe || !signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook dogrulanamadi." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Gecersiz Stripe imzasi." }, { status: 400 });
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
