import { NextResponse } from "next/server";
import {
  createMaintenanceRule,
  type CreateRulePayload,
} from "@/lib/services/maintenance-rules-service";
import { createClient } from "@/lib/supabase/server";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateRulePayload | null;

export async function POST(request: Request) {
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

  const result = await createMaintenanceRule(supabase, {
    userId: user.id,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
