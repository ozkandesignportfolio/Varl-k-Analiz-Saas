import { NextResponse } from "next/server";
import { existsById } from "@/lib/repos/assets-repo";
import { createClient } from "@/lib/supabase/server";

type CreateServiceLogPayload = {
  assetId?: unknown;
  ruleId?: unknown;
  serviceType?: unknown;
  serviceDate?: unknown;
  cost?: unknown;
  provider?: unknown;
  notes?: unknown;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateServiceLogPayload | null;

export async function POST(request: Request) {
  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const assetId = String(payload.assetId ?? "").trim();
  const ruleId = String(payload.ruleId ?? "").trim();
  const serviceType = String(payload.serviceType ?? "").trim();
  const serviceDate = String(payload.serviceDate ?? "").trim();
  const cost = Number(payload.cost ?? 0);
  const provider = String(payload.provider ?? "").trim();
  const notes = String(payload.notes ?? "").trim();

  if (!assetId || !serviceType || !serviceDate) {
    return NextResponse.json(
      { error: "Varlık, servis türü ve servis tarihi zorunludur." },
      { status: 400 },
    );
  }

  if (!datePattern.test(serviceDate)) {
    return NextResponse.json({ error: "Geçersiz tarih formatı." }, { status: 400 });
  }

  if (Number.isNaN(cost) || cost < 0) {
    return NextResponse.json({ error: "Maliyet geçersiz." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: assetExists, error: assetError } = await existsById(supabase, {
    assetId,
    userId: user.id,
  });

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 400 });
  }

  if (!assetExists) {
    return NextResponse.json({ error: "Seçilen varlığa erişim izniniz yok." }, { status: 403 });
  }

  if (ruleId) {
    const { data: rule, error: ruleError } = await supabase
      .from("maintenance_rules")
      .select("id,asset_id")
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ruleError) {
      return NextResponse.json({ error: ruleError.message }, { status: 400 });
    }

    if (!rule || rule.asset_id !== assetId) {
      return NextResponse.json({ error: "Seçilen bakım kuralına erişim izniniz yok." }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("service_logs")
    .insert({
      user_id: user.id,
      asset_id: assetId,
      rule_id: ruleId || null,
      service_type: serviceType,
      service_date: serviceDate,
      cost,
      provider: provider || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}


