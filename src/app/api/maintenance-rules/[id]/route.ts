import { NextResponse } from "next/server";
import {
  deleteMaintenanceRule,
  getMaintenanceRule,
  updateMaintenanceRule,
  type UpdateRulePayload,
} from "@/lib/services/maintenance-rules-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as UpdateRulePayload | null;

const getRuleId = async (context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return String(id ?? "").trim();
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ruleId = await getRuleId(context);
  if (!ruleId) {
    return NextResponse.json({ error: "Kural kimligi zorunludur." }, { status: 400 });
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const result = await getMaintenanceRule(supabase, {
    userId: user.id,
    ruleId,
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ruleId = await getRuleId(context);
  if (!ruleId) {
    return NextResponse.json({ error: "Kural kimligi zorunludur." }, { status: 400 });
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const result = await updateMaintenanceRule(supabase, {
    userId: user.id,
    ruleId,
    payload,
  });

  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ruleId = await getRuleId(context);
  if (!ruleId) {
    return NextResponse.json({ error: "Kural kimligi zorunludur." }, { status: 400 });
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const result = await deleteMaintenanceRule(supabase, {
    userId: user.id,
    ruleId,
  });

  return NextResponse.json(result.body, { status: result.status });
}
