import { NextResponse } from "next/server";
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
    return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const fullName = String(payload.fullName ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const phone = String(payload.phone ?? "").trim();
  const planCode = String(payload.planCode ?? "").trim() as PlanCode;
  const billingCycle = String(payload.billingCycle ?? "").trim() as BillingCycle;
  const source = String(payload.source ?? "landing").trim();

  if (!fullName || !email) {
    return NextResponse.json(
      { error: "Ad soyad ve e-posta alanlari zorunludur." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Gecersiz e-posta formati." }, { status: 400 });
  }

  if (!planCodes.includes(planCode)) {
    return NextResponse.json({ error: "Gecersiz plan secimi." }, { status: 400 });
  }

  if (!billingCycles.includes(billingCycle)) {
    return NextResponse.json({ error: "Gecersiz odeme donemi." }, { status: 400 });
  }

  const { error } = await supabase.from("subscription_requests").insert({
    full_name: fullName,
    email,
    phone: phone || null,
    plan_code: planCode,
    billing_cycle: billingCycle,
    status: "new",
    source,
  });

  if (error) {
    return NextResponse.json({ error: "Abonelik talebi kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
