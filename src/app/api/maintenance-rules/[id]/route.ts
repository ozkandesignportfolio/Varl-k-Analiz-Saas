import { NextResponse } from "next/server";
import {
  updateMaintenanceRule,
  type UpdateRulePayload,
} from "@/lib/services/maintenance-rules-service";
import { createClient } from "@/lib/supabase/server";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as UpdateRulePayload | null;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const ruleId = String(id ?? "").trim();
  if (!ruleId) {
    return NextResponse.json({ error: "Kural kimli\u011fi zorunludur." }, { status: 400 });
  }

  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Ge\u00e7ersiz istek g\u00f6vdesi." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await updateMaintenanceRule(supabase, {
    userId: user.id,
    ruleId,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
