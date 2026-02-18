import { NextResponse } from "next/server";
import {
  createMaintenanceRule,
  type CreateRulePayload,
} from "@/lib/services/maintenance-rules-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateRulePayload | null;

export async function POST(request: Request) {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Ge\u00e7ersiz istek g\u00f6vdesi." }, { status: 400 });
  }

  const result = await createMaintenanceRule(supabase, {
    userId: user.id,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}
