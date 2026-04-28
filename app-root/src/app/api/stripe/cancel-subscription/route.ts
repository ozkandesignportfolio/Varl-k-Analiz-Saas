import "server-only";

import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { getStripeClient } from "@/lib/services/stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

export async function POST(request: Request) {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = auth;

  let adminClient: ReturnType<typeof getSupabaseAdmin>;
  try {
    adminClient = getSupabaseAdmin();
  } catch (error) {
    logApiError({
      route: "/api/stripe/cancel-subscription",
      method: "POST",
      status: 500,
      error,
      message: "Admin client initialization failed during cancel-subscription.",
      userId: user.id,
    });
    return NextResponse.json({ error: "Sistem servisi başlatılamadı." }, { status: 500 });
  }
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("plan, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    logApiError({
      route: "/api/stripe/cancel-subscription",
      method: "POST",
      status: 500,
      error: profileError,
      message: "Failed to fetch profile for subscription cancellation.",
      userId: user.id,
    });
    return NextResponse.json({ error: "Profil bilgisi alınamadı." }, { status: 500 });
  }

  if (profile?.plan !== "premium") {
    return NextResponse.json({ error: "Aktif bir premium aboneliğiniz bulunmuyor." }, { status: 400 });
  }

  const subscriptionId = profile.stripe_subscription_id;
  if (!subscriptionId || typeof subscriptionId !== "string") {
    return NextResponse.json(
      { error: "Stripe abonelik bilgisi bulunamadı. Lütfen destek ile iletişime geçin." },
      { status: 400 },
    );
  }

  let stripeClient: ReturnType<typeof getStripeClient>;
  try {
    stripeClient = getStripeClient();
  } catch (error) {
    logApiError({
      route: "/api/stripe/cancel-subscription",
      method: "POST",
      status: 500,
      error,
      message: "Stripe client initialization failed during cancel-subscription.",
      userId: user.id,
    });
    return NextResponse.json({ error: "Stripe servisi başlatılamadı." }, { status: 500 });
  }

  try {
    const updatedSubscription = await stripeClient.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    const rawPeriodEnd = (updatedSubscription as unknown as { current_period_end?: number }).current_period_end;
    const currentPeriodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null;

    await adminClient
      .from("profiles")
      .update({
        cancel_at_period_end: true,
        stripe_current_period_end: currentPeriodEnd,
      })
      .eq("id", user.id);

    return NextResponse.json({ ok: true, currentPeriodEnd }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/stripe/cancel-subscription",
      method: "POST",
      status: 500,
      error,
      message: "Stripe subscription cancellation failed.",
      userId: user.id,
      meta: {
        subscriptionId,
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: "Abonelik iptal edilemedi." }, { status: 500 });
  }
}
