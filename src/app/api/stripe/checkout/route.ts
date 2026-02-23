import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
};

export async function POST(request: Request) {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { user } = auth;

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe yapılandırması eksik." }, { status: 500 });
  }

  const priceId = process.env.STRIPE_PRICE_PREMIUM_MONTHLY?.trim();
  if (!priceId) {
    return NextResponse.json({ error: "Premium fiyatı yapılandırılmamış." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      success_url: `${origin}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings?checkout=cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout URL oluşturulamadı." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Checkout oturumu başlatılamadı." }, { status: 500 });
  }
}
