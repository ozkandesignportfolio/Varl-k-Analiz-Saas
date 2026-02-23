import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireRouteUser } from "@/lib/supabase/route-auth";

type ConfirmPayload = {
  session_id?: unknown;
};

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey);
};

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

  const payload = (await request.json().catch(() => null)) as ConfirmPayload | null;
  const sessionId = String(payload?.session_id ?? "").trim();

  if (!sessionId) {
    return NextResponse.json({ error: "session_id zorunludur." }, { status: 400 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe yapılandırması eksik." }, { status: 500 });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Checkout oturumu doğrulanamadı." }, { status: 400 });
  }

  if (session.client_reference_id && session.client_reference_id !== user.id) {
    return NextResponse.json({ error: "Bu checkout oturumu kullanıcıya ait değil." }, { status: 403 });
  }

  if (!isPremiumCheckoutCompleted(session)) {
    return NextResponse.json({ error: "Checkout henüz tamamlanmadı." }, { status: 400 });
  }

  const nextUserMetadata = buildPremiumMetadata((user.user_metadata ?? {}) as Record<string, unknown>);
  const nextAppMetadata = buildPremiumMetadata((user.app_metadata ?? {}) as Record<string, unknown>);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: nextAppMetadata,
      user_metadata: nextUserMetadata,
    });

    if (error) {
      return NextResponse.json({ error: "Premium planı aktifleştirilemedi." }, { status: 500 });
    }
  } else {
    const { error } = await supabase.auth.updateUser({
      data: nextUserMetadata,
    });

    if (error) {
      return NextResponse.json({ error: "Premium planı aktifleştirilemedi." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
