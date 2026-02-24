import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const normalizeBaseUrl = (value: string | undefined) => value?.trim().replace(/\/+$/, "");

const resolveAppUrl = (request: Request) => {
  const envAppUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ?? normalizeBaseUrl(process.env.APP_URL);
  if (envAppUrl) {
    return envAppUrl;
  }

  const requestUrl = new URL(request.url);
  const forwardedHost =
    request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim() ??
    request.headers.get("host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim() ?? requestUrl.protocol.replace(":", "");

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
  }

  return requestUrl.origin.replace(/\/+$/, "");
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
  const appUrl = resolveAppUrl(request);

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
