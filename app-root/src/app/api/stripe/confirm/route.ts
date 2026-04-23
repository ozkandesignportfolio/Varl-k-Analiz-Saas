import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import Stripe from "stripe";
import { enforceUserRateLimit } from "@/lib/api/rate-limit";
import { getStripeClient } from "@/lib/services/stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";

type ConfirmPayload = {
  session_id?: unknown;
};

const STRIPE_CONFIRM_RATE_LIMIT_CAPACITY = 10;
const STRIPE_CONFIRM_RATE_LIMIT_REFILL_PER_SECOND = STRIPE_CONFIRM_RATE_LIMIT_CAPACITY / 60;

const isPremiumCheckoutCompleted = (session: Stripe.Checkout.Session) => {
  if (session.payment_status === "paid") {
    return true;
  }

  if (session.status === "complete") {
    return true;
  }

  return Boolean(session.subscription);
};

const buildPremiumMetadata = (current: Record<string, unknown>) => ({
  ...current,
  plan_code: "pro",
  planCode: "pro",
  plan: "premium",
  subscription_plan: "premium",
  subscriptionPlan: "premium",
  tier: "premium",
});

export async function POST(request: Request) {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const rateLimit = await enforceUserRateLimit({
    client: supabase,
    scope: "api_stripe_confirm",
    userId: user.id,
    capacity: STRIPE_CONFIRM_RATE_LIMIT_CAPACITY,
    refillPerSecond: STRIPE_CONFIRM_RATE_LIMIT_REFILL_PER_SECOND,
    ttlSeconds: 180,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Cok fazla odeme dogrulama istegi gonderildi. Lutfen tekrar deneyin." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
        },
      },
    );
  }

  const payload = (await request.json().catch(() => null)) as ConfirmPayload | null;
  const sessionId = String(payload?.session_id ?? "").trim();

  if (!sessionId) {
    return NextResponse.json({ error: "session_id zorunludur." }, { status: 400 });
  }

  let stripeClient: ReturnType<typeof getStripeClient>;
  try {
    stripeClient = getStripeClient();
  } catch (error) {
    logApiError({
      route: "/api/stripe/confirm",
      method: "POST",
      status: 500,
      error,
      message: "Stripe client initialization failed during confirm.",
      userId: user.id,
    });
    return NextResponse.json({ error: "Ödeme doğrulama servisi başlatılamadı." }, { status: 500 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripeClient.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Checkout oturumu doğrulanamadı." }, { status: 400 });
  }

  if (session.client_reference_id && session.client_reference_id !== user.id) {
    return NextResponse.json({ error: "Bu checkout oturumu kullanıcıya ait değil." }, { status: 403 });
  }

  if (!isPremiumCheckoutCompleted(session)) {
    return NextResponse.json({ error: "Checkout henüz tamamlanmadı." }, { status: 400 });
  }

  const { error: profileUpdateError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      plan: "premium",
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
    },
    {
      onConflict: "id",
    },
  );

  if (profileUpdateError) {
    logApiError({
      route: "/api/stripe/confirm",
      method: "POST",
      status: 500,
      error: profileUpdateError,
      message: "Profile plan update failed during Stripe confirm.",
      userId: user.id,
      meta: {
        code: profileUpdateError.code ?? null,
      },
    });
    return NextResponse.json({ error: "Profil planı premium olarak güncellenemedi." }, { status: 500 });
  }

  const nextUserMetadata = buildPremiumMetadata((user.user_metadata ?? {}) as Record<string, unknown>);
  const nextAppMetadata = buildPremiumMetadata((user.app_metadata ?? {}) as Record<string, unknown>);

  let adminClient: ReturnType<typeof getSupabaseAdmin>;
  try {
    adminClient = getSupabaseAdmin();
  } catch (error) {
    logApiError({
      route: "/api/stripe/confirm",
      method: "POST",
      status: 500,
      error,
      message: "Admin client initialization failed during confirm.",
      userId: user.id,
    });
    return NextResponse.json({ error: "Sistem servisi başlatılamadı." }, { status: 500 });
  }
  const { error: adminUpdateError } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: nextAppMetadata,
    user_metadata: nextUserMetadata,
  });

  if (adminUpdateError) {
    logApiError({
      route: "/api/stripe/confirm",
      method: "POST",
      status: 500,
      error: adminUpdateError,
      message: "Admin metadata update failed during Stripe confirm.",
      userId: user.id,
      meta: {
        code: adminUpdateError.code ?? null,
      },
    });
    return NextResponse.json({ error: "Premium planı aktifleştirilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
