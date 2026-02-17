import { NextResponse } from "next/server";
import { calculateNextDueDate, type IntervalUnit } from "@/lib/maintenance/next-due";
import { createClient } from "@/lib/supabase/server";

type CreateRulePayload = {
  assetId?: unknown;
  title?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
  lastServiceDate?: unknown;
};

const intervalUnits: IntervalUnit[] = ["day", "week", "month", "year"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateRulePayload | null;

export async function POST(request: Request) {
  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const assetId = String(payload.assetId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const intervalValue = Number(payload.intervalValue);
  const intervalUnit = String(payload.intervalUnit ?? "").trim() as IntervalUnit;
  const lastServiceDate = String(payload.lastServiceDate ?? "").trim();

  if (!assetId || !title || !lastServiceDate) {
    return NextResponse.json(
      { error: "Varlık, başlık ve baz tarih zorunludur." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
    return NextResponse.json(
      { error: "Interval değeri pozitif bir tam sayı olmalı." },
      { status: 400 },
    );
  }

  if (!intervalUnits.includes(intervalUnit)) {
    return NextResponse.json({ error: "Geçersiz interval birimi." }, { status: 400 });
  }

  if (!datePattern.test(lastServiceDate)) {
    return NextResponse.json({ error: "Geçersiz tarih formatı." }, { status: 400 });
  }

  let nextDueDate = "";
  try {
    nextDueDate = calculateNextDueDate({
      baseDate: lastServiceDate,
      intervalValue,
      intervalUnit,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { data, error } = await supabase
    .from("maintenance_rules")
    .insert({
      user_id: user.id,
      asset_id: assetId,
      title,
      interval_value: intervalValue,
      interval_unit: intervalUnit,
      last_service_date: lastServiceDate,
      next_due_date: nextDueDate,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}


