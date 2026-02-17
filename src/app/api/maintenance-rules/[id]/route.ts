import { NextResponse } from "next/server";
import { calculateNextDueDate, type IntervalUnit } from "@/lib/maintenance/next-due";
import { createClient } from "@/lib/supabase/server";

type UpdateRulePayload = {
  assetId?: unknown;
  title?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
  lastServiceDate?: unknown;
  isActive?: unknown;
};

const intervalUnits: IntervalUnit[] = ["day", "week", "month", "year"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as UpdateRulePayload | null;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ruleId = String(id ?? "").trim();
  if (!ruleId) {
    return NextResponse.json({ error: "Kural kimliği zorunludur." }, { status: 400 });
  }

  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: currentRule, error: currentRuleError } = await supabase
    .from("maintenance_rules")
    .select("id,asset_id,user_id,title,interval_value,interval_unit,last_service_date,next_due_date,is_active")
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .single();

  if (currentRuleError || !currentRule) {
    return NextResponse.json({ error: "Kural bulunamadı." }, { status: 404 });
  }

  const hasAssetId = payload.assetId !== undefined;
  const hasTitle = payload.title !== undefined;
  const hasIntervalValue = payload.intervalValue !== undefined;
  const hasIntervalUnit = payload.intervalUnit !== undefined;
  const hasLastServiceDate = payload.lastServiceDate !== undefined;
  const hasIsActive = payload.isActive !== undefined;

  if (
    !hasAssetId &&
    !hasTitle &&
    !hasIntervalValue &&
    !hasIntervalUnit &&
    !hasLastServiceDate &&
    !hasIsActive
  ) {
    return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
  }

  const updatePayload: {
    asset_id?: string;
    title?: string;
    interval_value?: number;
    interval_unit?: IntervalUnit;
    last_service_date?: string;
    next_due_date?: string;
    is_active?: boolean;
  } = {};

  if (hasAssetId) {
    const assetId = String(payload.assetId ?? "").trim();
    if (!assetId) {
      return NextResponse.json({ error: "Varlık seçimi zorunludur." }, { status: 400 });
    }

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 400 });
    }

    if (!asset) {
      return NextResponse.json({ error: "Seçilen varlığa erişim izniniz yok." }, { status: 403 });
    }

    updatePayload.asset_id = assetId;
  }

  if (hasTitle) {
    const title = String(payload.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Kural başlığı zorunludur." }, { status: 400 });
    }
    updatePayload.title = title;
  }

  if (hasIntervalValue) {
    const intervalValue = Number(payload.intervalValue);
    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      return NextResponse.json(
        { error: "Interval değeri pozitif bir tam sayı olmalı." },
        { status: 400 },
      );
    }
    updatePayload.interval_value = intervalValue;
  }

  if (hasIntervalUnit) {
    const intervalUnit = String(payload.intervalUnit ?? "").trim() as IntervalUnit;
    if (!intervalUnits.includes(intervalUnit)) {
      return NextResponse.json({ error: "Geçersiz interval birimi." }, { status: 400 });
    }
    updatePayload.interval_unit = intervalUnit;
  }

  if (hasLastServiceDate) {
    const lastServiceDate = String(payload.lastServiceDate ?? "").trim();
    if (!datePattern.test(lastServiceDate)) {
      return NextResponse.json({ error: "Geçersiz tarih formatı." }, { status: 400 });
    }
    updatePayload.last_service_date = lastServiceDate;
  }

  if (hasIsActive) {
    updatePayload.is_active = Boolean(payload.isActive);
  }

  if (hasIntervalValue || hasIntervalUnit || hasLastServiceDate) {
    const baseDate = updatePayload.last_service_date ?? currentRule.last_service_date;
    const intervalValue = updatePayload.interval_value ?? currentRule.interval_value;
    const intervalUnit = updatePayload.interval_unit ?? currentRule.interval_unit;

    if (!baseDate) {
      return NextResponse.json(
        { error: "Baz tarih olmadan sonraki bakım tarihi hesaplanamaz." },
        { status: 400 },
      );
    }

    try {
      updatePayload.next_due_date = calculateNextDueDate({
        baseDate,
        intervalValue,
        intervalUnit,
      });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("maintenance_rules")
    .update(updatePayload)
    .eq("id", ruleId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
}


