import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";

type QueryError = {
  message?: string | null;
};

type HealthStatus = "ok" | "degraded" | "fail";
type DatabaseStatus = "ok" | "fail";
type CacheStatus = "ok" | "stale";
type RpcStatus = "ok" | "fail";

type HealthResponse = {
  status: HealthStatus;
  components: {
    database: DatabaseStatus;
    cache: CacheStatus;
    rpc: RpcStatus;
  };
  checkedAt: string;
};

type GlobalMetricsCacheRow = {
  computed_at: string | null;
};

const CACHE_KEY = "dashboard";
const CACHE_TTL_MS = 15 * 60 * 1000;
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const INTERNAL_SECRET_HEADER = "x-panel-health-secret";

type PublicVisibility = "summary" | "detailed";

const safeCompare = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const hasInternalAccess = (request: NextRequest) => {
  const expectedSecret = process.env.PANEL_HEALTH_SECRET?.trim();
  if (!expectedSecret) {
    return false;
  }

  const providedSecret = request.headers.get(INTERNAL_SECRET_HEADER)?.trim();
  if (!providedSecret) {
    return false;
  }

  return safeCompare(providedSecret, expectedSecret);
};

const getPublicVisibility = (): PublicVisibility => {
  const configuredVisibility = process.env.PANEL_HEALTH_PUBLIC_VISIBILITY?.trim().toLowerCase();
  if (configuredVisibility === "detailed") {
    return "detailed";
  }

  if (configuredVisibility === "summary") {
    return "summary";
  }

  return process.env.NODE_ENV === "production" ? "summary" : "detailed";
};

const toPublicComponents = (status: HealthStatus): HealthResponse["components"] => {
  if (status === "ok") {
    return { database: "ok", cache: "ok", rpc: "ok" };
  }

  if (status === "degraded") {
    return { database: "ok", cache: "stale", rpc: "ok" };
  }

  return { database: "fail", cache: "stale", rpc: "fail" };
};

const getServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createServiceRoleClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const checkAuthDependency = async (serviceClient: unknown) => {
  if (!serviceClient) {
    return false;
  }

  try {
    const authClient = serviceClient as {
      auth: {
        admin: {
          listUsers: (
            params?: { page?: number; perPage?: number },
          ) => Promise<{ data: unknown; error: QueryError | null }>;
        };
      };
    };

    const { error } = await authClient.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  } catch {
    return false;
  }
};

const checkDatabaseConnection = async (serviceClient: unknown) => {
  if (!serviceClient) {
    return false;
  }

  try {
    const dbClient = serviceClient as {
      from: (table: "global_metrics_cache") => {
        select: (
          columns: "key",
        ) => {
          limit: (value: number) => Promise<{ data: unknown; error: QueryError | null }>;
        };
      };
    };

    const { error } = await dbClient.from("global_metrics_cache").select("key").limit(1);
    return !error;
  } catch {
    return false;
  }
};

const checkCacheFreshness = async (serviceClient: unknown): Promise<CacheStatus> => {
  if (!serviceClient) {
    return "stale";
  }

  try {
    const cacheClient = serviceClient as {
      from: (table: "global_metrics_cache") => {
        select: (
          columns: "computed_at",
        ) => {
          eq: (
            column: "key",
            value: string,
          ) => {
            maybeSingle: () => Promise<{ data: GlobalMetricsCacheRow | null; error: QueryError | null }>;
          };
        };
      };
    };

    const { data, error } = await cacheClient
      .from("global_metrics_cache")
      .select("computed_at")
      .eq("key", CACHE_KEY)
      .maybeSingle();

    if (error || !data?.computed_at) {
      return "stale";
    }

    const computedAtMs = new Date(data.computed_at).getTime();
    if (!Number.isFinite(computedAtMs)) {
      return "stale";
    }

    return Date.now() - computedAtMs >= CACHE_TTL_MS ? "stale" : "ok";
  } catch {
    return "stale";
  }
};

const checkRpcAvailability = async (client: unknown) => {
  if (!client) {
    return false;
  }

  try {
    const rpcClient = client as {
      rpc: (
        fn: "compute_panel_health",
        args: { p_user_id: string },
      ) => Promise<{ data: unknown; error: QueryError | null }>;
    };
    const { error } = await rpcClient.rpc("compute_panel_health", {
      p_user_id: ZERO_UUID,
    });
    return !error;
  } catch {
    return false;
  }
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString();
  const serviceClient = getServiceRoleClient();

  const [authOk, dbOk, cacheStatus, rpcOk] = await Promise.all([
    checkAuthDependency(serviceClient),
    checkDatabaseConnection(serviceClient),
    checkCacheFreshness(serviceClient),
    checkRpcAvailability(serviceClient),
  ]);

  // Auth is a critical dependency; it is folded into database component health.
  const databaseStatus: DatabaseStatus = authOk && dbOk ? "ok" : "fail";
  const rpcStatus: RpcStatus = rpcOk ? "ok" : "fail";
  const criticalFailure = databaseStatus === "fail" || rpcStatus === "fail";

  const fullResponse: HealthResponse = {
    status: criticalFailure ? "fail" : cacheStatus === "stale" ? "degraded" : "ok",
    components: {
      database: databaseStatus,
      cache: cacheStatus,
      rpc: rpcStatus,
    },
    checkedAt,
  };

  const canSeeDetailedHealth = hasInternalAccess(request) || getPublicVisibility() === "detailed";
  const response: HealthResponse = canSeeDetailedHealth
    ? fullResponse
    : {
        ...fullResponse,
        components: toPublicComponents(fullResponse.status),
      };

  return NextResponse.json(response, { status: criticalFailure ? 500 : 200 });
}
