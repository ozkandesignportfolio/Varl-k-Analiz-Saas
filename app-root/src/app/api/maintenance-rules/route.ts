import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import {
  createMaintenanceRule,
  listMaintenanceRules,
  type CreateRulePayload,
} from "@/lib/services/maintenance-rules-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateRulePayload | null;

export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    const { supabase, user } = auth;
    userId = user.id;

    const result = await listMaintenanceRules(supabase, {
      userId: user.id,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logApiError({
      route: "/api/maintenance-rules",
      method: "GET",
      userId,
      error,
      message: "Maintenance rules list request failed unexpectedly",
    });
    return NextResponse.json({ error: "Bakım kurallar? listelenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    const { supabase, user } = auth;
    userId = user.id;

    const payload = await readBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const result = await createMaintenanceRule(supabase, {
      userId: user.id,
      payload,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logApiError({
      route: "/api/maintenance-rules",
      method: "POST",
      userId,
      error,
      message: "Maintenance rule create request failed unexpectedly",
    });
    return NextResponse.json({ error: "Bakım kuralı isteği işlenemedi." }, { status: 500 });
  }
}



