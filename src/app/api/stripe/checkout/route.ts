import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const normalizeBaseUrl = (value: string | undefined) => value?.trim().replace(/\/+$/, "");

const resolveAppUrl = () => {
  const envAppUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ?? normalizeBaseUrl(process.env.APP_URL);

  if (!envAppUrl) {
    throw new Error("APP_URL is required");
  }

  return envAppUrl;
};

const readMissingEnvVars = () => {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    missing.push("STRIPE_SECRET_KEY");
  }

  const premiumPriceId =
    process.env.STRIPE_PRICE_PREMIUM?.trim() || process.env.STRIPE_PRICE_PREMIUM_MONTHLY?.trim();
  if (!premiumPriceId) {
    missing.push("STRIPE_PRICE_PREMIUM|STRIPE_PRICE_PREMIUM_MONTHLY");
  }

  return {
    missing,
    premiumPriceId,
  };
};

export async function POST(request: Request) {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envCheck = readMissingEnvVars();
  if (envCheck.missing.length > 0) {
    return NextResponse.json(
      { error: `Eksik ortam degiskenleri: ${envCheck.missing.join(", ")}` },
      { status: 500 },
    );
  }

  const { user } = auth;

  if (!stripe) {
    return NextResponse.json({ error: "Stripe yapilandirmasi eksik." }, { status: 500 });
  }

  const priceId = envCheck.premiumPriceId as string;
  let appUrl: string;
  try {
    appUrl = resolveAppUrl();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "APP_URL is required" },
      { status: 500 },
    );
  }

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
      metadata: {
        userId: user.id,
      },
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout URL olusturulamadi." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Stripe checkout session creation failed.", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Checkout oturumu baslatilamadi." }, { status: 500 });
  }
}
