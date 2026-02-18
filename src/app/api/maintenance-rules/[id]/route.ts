import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
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
  let userId: string | null = null;
  try {
    const ruleId = await getRuleId(context);
    if (!ruleId) {
      return NextResponse.json({ error: "Kural kimligi zorunludur." }, { status: 400 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    const { supabase, user } = auth;
    userId = user.id;

    const result = await getMaintenanceRule(supabase, {
      userId: user.id,
      ruleId,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logApiError({
      route: "/api/maintenance-rules/[id]",
      method: "GET",
      userId,
      error,
      message: "Maintenance rule detail request failed unexpectedly",
    });
    return NextResponse.json({ error: "Bakim kurali okunamadi." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let userId: string | null = null;
  try {
    const ruleId = await getRuleId(context);
    if (!ruleId) {
      return NextResponse.json({ error: "Kural kimligi zorunludur." }, { status: 400 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    const { supabase, user } = auth;
    userId = user.id;

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
  } catch (error) {
    logApiError({
      route: "/api/maintenance-rules/[id]",
      method: "PATCH",
      userId,
      error,
      message: "Maintenance rule update request failed unexpectedly",
    });
    return NextResponse.json({ error: "Bakim kurali guncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let userId: string | null = null;
  try {
    const ruleId = await getRuleId(context);
    if (!ruleId) {
      return NextResponse.json({ error: "Kural kimligi zorunludur." }, { status: 400 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    const { supabase, user } = auth;
    userId = user.id;

    const result = await deleteMaintenanceRule(supabase, {
      userId: user.id,
      ruleId,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logApiError({
      route: "/api/maintenance-rules/[id]",
      method: "DELETE",
      userId,
      error,
      message: "Maintenance rule delete request failed unexpectedly",
    });
    return NextResponse.json({ error: "Bakim kurali silinemedi." }, { status: 500 });
  }
}

