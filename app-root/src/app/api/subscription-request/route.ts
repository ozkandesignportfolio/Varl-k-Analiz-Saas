import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { requireRouteUser } from "@/lib/supabase/route-auth";

type PlanCode = "starter" | "pro" | "elite";
type BillingCycle = "monthly" | "yearly";

type RequestPayload = {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  planCode?: unknown;
  billingCycle?: unknown;
  source?: unknown;
};

const planCodes: PlanCode[] = ["starter", "pro", "elite"];
const billingCycles: BillingCycle[] = ["monthly", "yearly"];

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function POST(request: Request) {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase } = auth;

  const payload = (await request.json().catch(() => null)) as RequestPayload | null;

  if (!payload) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const fullName = String(payload.fullName ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const phone = String(payload.phone ?? "").trim();
  const planCode = String(payload.planCode ?? "").trim() as PlanCode;
  const billingCycle = String(payload.billingCycle ?? "").trim() as BillingCycle;
  const source = String(payload.source ?? "landing").trim();
  const authenticatedEmail = String(auth.user.email ?? "").trim().toLowerCase();

  if (!fullName) {
    return NextResponse.json(
      { error: "Ad soyad ve e-posta alanları zorunludur." },
      { status: 400 },
    );
  }

  if (!authenticatedEmail) {
    return NextResponse.json(
      { error: "Doğrulanmış hesap e-postası bulunamadı." },
      { status: 400 },
    );
  }

  if (!isValidEmail(authenticatedEmail)) {
    return NextResponse.json({ error: "Geçersiz hesap e-posta formatı." }, { status: 400 });
  }

  if (email && email !== authenticatedEmail) {
    return NextResponse.json(
      { error: "E-posta adresi hesabınızdaki e-posta ile eşleşmelidir." },
      { status: 400 },
    );
  }

  if (!planCodes.includes(planCode)) {
    return NextResponse.json({ error: "Geçersiz plan seçimi." }, { status: 400 });
  }

  if (!billingCycles.includes(billingCycle)) {
    return NextResponse.json({ error: "Geçersiz ödeme dönemi." }, { status: 400 });
  }

  const { error } = await supabase.from("subscription_requests").insert({
    user_id: auth.user.id,
    full_name: fullName,
    email: authenticatedEmail,
    phone: phone || null,
    plan_code: planCode,
    billing_cycle: billingCycle,
    status: "new",
    source,
  });

  if (error) {
    logApiError({
      route: "/api/subscription-request",
      method: "POST",
      status: 500,
      error,
      message: "Subscription request insert failed.",
      userId: auth.user.id,
      meta: {
        code: error.code ?? null,
      },
    });
    return NextResponse.json({ error: "Abonelik talebi kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
