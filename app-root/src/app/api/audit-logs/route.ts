import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { toPublicErrorBody } from "@/lib/api/public-error";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const allowedEntityTypes = ["assets", "maintenance_rules", "service_logs", "documents"] as const;
const allowedActions = ["insert", "update", "delete"] as const;

type EntityType = (typeof allowedEntityTypes)[number];
type ActionType = (typeof allowedActions)[number];

const parseListParam = (searchParams: URLSearchParams, key: string) =>
  searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const asEntityTypes = (values: string[]) =>
  values.filter((value): value is EntityType =>
    allowedEntityTypes.includes(value as EntityType),
  );

const asActionTypes = (values: string[]) =>
  values.filter((value): value is ActionType => allowedActions.includes(value as ActionType));

const isMissingAuditLogsTableError = (error: { code?: string; message?: string }) => {
  const normalized = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    normalized.includes("public.audit_logs") ||
    normalized.includes("schema cache")
  );
};

export async function GET(request: Request) {
  const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
  const rl = enforceRateLimit({
    scope: "api",
    key: requestIp,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const searchParams = new URL(request.url).searchParams;
  const parsedLimit = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
    : 20;

  const entityTypes = asEntityTypes(parseListParam(searchParams, "entityType"));
  const actions = asActionTypes(parseListParam(searchParams, "action"));
  const entityId = String(searchParams.get("entityId") ?? "").trim();

  let query = supabase
    .from("audit_logs")
    .select("id,user_id,entity_type,entity_id,action,changed_fields,old_values,new_values,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityTypes.length === 1) {
    query = query.eq("entity_type", entityTypes[0]);
  } else if (entityTypes.length > 1) {
    query = query.in("entity_type", entityTypes);
  }

  if (actions.length === 1) {
    query = query.eq("action", actions[0]);
  } else if (actions.length > 1) {
    query = query.in("action", actions);
  }

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingAuditLogsTableError(error)) {
      return NextResponse.json(
        { logs: [], warning: "audit_logs tablosu bulunamadı, panel boş döndürüldü." },
        { status: 200 },
      );
    }

    logApiError({
      route: "/api/audit-logs",
      method: "GET",
      status: 400,
      error,
      message: "Audit logs query failed.",
      userId: user.id,
      meta: {
        code: error.code ?? null,
      },
    });

    return NextResponse.json(
      toPublicErrorBody("AUDIT_LOGS_QUERY_FAILED", "Denetim kayıtları şu anda alınamadı."),
      { status: 400 },
    );
  }

  return NextResponse.json({ logs: data ?? [] }, { status: 200 });
}
