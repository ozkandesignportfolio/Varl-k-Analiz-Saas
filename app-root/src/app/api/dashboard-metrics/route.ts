import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type PostgrestError } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { logApiError, logApiRequest } from "@/lib/api/logging";
import { enforceUserRateLimit } from "@/lib/api/rate-limit";
import { requireRouteUser } from "@/lib/supabase/route-auth";

type MetricScope = "user" | "global" | "public_fallback";

type MetricsPayload = {
  activeUsers: number;
  trackedAssets: number;
  completedTransactions: number;
  systemHealthRate: number;
  scope: MetricScope;
  generatedAt: string;
};

type GlobalMetricsCacheRow = {
  payload: unknown;
  computed_at: string;
};

const CACHE_KEY = "dashboard";
const CACHE_TTL_MS = 15 * 60 * 1000;
const DASHBOARD_METRICS_RATE_LIMIT_CAPACITY = 90;
const DASHBOARD_METRICS_RATE_LIMIT_REFILL_PER_SECOND = DASHBOARD_METRICS_RATE_LIMIT_CAPACITY / 60;

export const dynamic = "force-dynamic";

const getNow = () => new Date();

const toIso = (date: Date) => date.toISOString();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonNegativeInt = (value: unknown, fallback = 0) => {
  const parsed = Math.round(toNumber(value, fallback));
  return parsed > 0 ? parsed : 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const buildZeroPayload = (scope: MetricScope = "public_fallback"): MetricsPayload => ({
  activeUsers: 0,
  trackedAssets: 0,
  completedTransactions: 0,
  systemHealthRate: 0,
  scope,
  generatedAt: toIso(getNow()),
});

const normalizePayload = (value: unknown): MetricsPayload => {
  if (!isRecord(value)) {
    return buildZeroPayload("global");
  }

  const generatedAtRaw = value.generatedAt;
  const generatedAt =
    typeof generatedAtRaw === "string" && generatedAtRaw.length > 0 ? generatedAtRaw : toIso(getNow());
  const scope: MetricScope = value.scope === "user" || value.scope === "global" ? value.scope : "public_fallback";

  return {
    activeUsers: toNonNegativeInt(value.activeUsers),
    trackedAssets: toNonNegativeInt(value.trackedAssets),
    completedTransactions: toNonNegativeInt(value.completedTransactions),
    systemHealthRate: Math.max(0, Math.min(100, toNonNegativeInt(value.systemHealthRate))),
    scope,
    generatedAt,
  };
};

const getServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const fetchCacheRow = async (serviceClient: ReturnType<typeof getServiceRoleClient>) => {
  if (!serviceClient) return null;

  const tableClient = serviceClient as unknown as {
    from: (tableName: "global_metrics_cache") => {
      select: (
        columns: "payload,computed_at",
      ) => {
        eq: (
          column: "key",
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: GlobalMetricsCacheRow | null; error: PostgrestError | null }>;
        };
      };
    };
  };

  const { data, error } = await tableClient
    .from("global_metrics_cache")
    .select("payload,computed_at")
    .eq("key", CACHE_KEY)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
};

const triggerRefreshInBackground = (serviceClient: ReturnType<typeof getServiceRoleClient>) => {
  if (!serviceClient) return;

  const rpcClient = serviceClient as unknown as {
    rpc: (
      fn: "refresh_global_metrics_cache",
      args: { p_key: string },
    ) => Promise<{ data: unknown; error: PostgrestError | null }>;
  };

  void (async () => {
    try {
      await rpcClient.rpc("refresh_global_metrics_cache", { p_key: CACHE_KEY });
    } catch {
      // Best-effort refresh. Serving cached/fallback payload is still valid.
    }
  })();
};

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const startedAt = Date.now();
  let userId: string | null = null;
  let responseStatus = 500;
  let dbTimeMs = 0;

  const timeDb = async <T>(work: () => Promise<T>) => {
    const started = Date.now();
    try {
      return await work();
    } finally {
      dbTimeMs += Date.now() - started;
    }
  };

  const finalize = <T extends NextResponse>(response: T) => {
    responseStatus = response.status;
    return response;
  };

  const respond = (body: unknown, init?: ResponseInit) => finalize(NextResponse.json(body, init));

  try {
    const auth = await timeDb(() => requireRouteUser(request));
    if ("response" in auth) {
      return finalize(auth.response);
    }
    userId = auth.user.id;

    const rateLimit = await timeDb(() =>
      enforceUserRateLimit({
        client: auth.supabase,
        scope: "api_dashboard_metrics",
        userId: auth.user.id,
        capacity: DASHBOARD_METRICS_RATE_LIMIT_CAPACITY,
        refillPerSecond: DASHBOARD_METRICS_RATE_LIMIT_REFILL_PER_SECOND,
        ttlSeconds: 180,
      }),
    );

    if (!rateLimit.allowed) {
      return respond(
        { error: "Dashboard metrik istegi limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      return respond(buildZeroPayload("public_fallback"), { status: 200 });
    }

    const cache = await timeDb(() => fetchCacheRow(serviceClient));
    if (!cache) {
      triggerRefreshInBackground(serviceClient);
      return respond(buildZeroPayload("global"), { status: 200 });
    }

    const computedAtMs = new Date(cache.computed_at).getTime();
    const stale = !Number.isFinite(computedAtMs) || getNow().getTime() - computedAtMs >= CACHE_TTL_MS;
    if (stale) {
      triggerRefreshInBackground(serviceClient);
    }

    return respond(normalizePayload(cache.payload), { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/dashboard-metrics",
      method: "GET",
      requestId,
      userId,
      status: 500,
      error,
      durationMs: Date.now() - startedAt,
      dbTimeMs,
      openAiTimeMs: null,
      message: "Dashboard metrics request failed unexpectedly",
    });
    return respond(buildZeroPayload("public_fallback"), { status: 200 });
  } finally {
    logApiRequest({
      route: "/api/dashboard-metrics",
      method: "GET",
      requestId,
      userId,
      status: responseStatus,
      durationMs: Date.now() - startedAt,
      dbTimeMs,
      openAiTimeMs: null,
    });
  }
}
