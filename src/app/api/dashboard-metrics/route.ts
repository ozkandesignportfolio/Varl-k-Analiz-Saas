import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type PostgrestError } from "@supabase/supabase-js";

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

  void rpcClient.rpc("refresh_global_metrics_cache", { p_key: CACHE_KEY }).catch(() => undefined);
};

export async function GET() {
  try {
    const serviceClient = getServiceRoleClient();
    if (!serviceClient) {
      return NextResponse.json(buildZeroPayload("public_fallback"), { status: 200 });
    }

    const cache = await fetchCacheRow(serviceClient);
    if (!cache) {
      triggerRefreshInBackground(serviceClient);
      return NextResponse.json(buildZeroPayload("global"), { status: 200 });
    }

    const computedAtMs = new Date(cache.computed_at).getTime();
    const stale = !Number.isFinite(computedAtMs) || getNow().getTime() - computedAtMs >= CACHE_TTL_MS;
    if (stale) {
      triggerRefreshInBackground(serviceClient);
    }

    return NextResponse.json(normalizePayload(cache.payload), { status: 200 });
  } catch {
    return NextResponse.json(buildZeroPayload("public_fallback"), { status: 200 });
  }
}
