import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateRatioScore } from "@/lib/scoring/ratio-score";
import { createClient } from "@/lib/supabase/server";

type MetricScope = "user" | "global" | "public_fallback";

type MetricsPayload = {
  activeUsers: number;
  trackedAssets: number;
  completedTransactions: number;
  systemHealthRate: number;
  scope: MetricScope;
  generatedAt: string;
};

type UserLike = {
  id: string;
  last_sign_in_at?: string | null;
  updated_at?: string | null;
};

type AssetHealthRow = {
  health_score?: number | null;
};

type AssetRow = {
  id: string;
  name: string | null;
};

type ServiceLogRow = {
  asset_id: string;
  cost: number | null;
};

type ExpenseRow = {
  asset_id: string | null;
  amount: number | null;
  category: string | null;
  note: string | null;
};

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const LIST_USERS_PAGE_SIZE = 1000;
const MAX_LIST_USERS_PAGES = 200;

export const dynamic = "force-dynamic";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getNow = () => new Date();

const toIso = (date: Date) => date.toISOString();

const isRecentDate = (value: string | null | undefined, sinceDate: Date) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed >= sinceDate;
};

const isMissingTableError = (error: { code?: string | null; message?: string | null } | null) => {
  if (!error) return false;
  const code = error.code ?? "";
  if (MISSING_TABLE_CODES.has(code)) return true;
  const normalized = (error.message ?? "").toLowerCase();
  return normalized.includes("does not exist") && normalized.includes("table");
};

const isMissingHealthScoreColumn = (error: { code?: string | null; message?: string | null } | null) => {
  if (!error) return false;
  const code = error.code ?? "";
  if (MISSING_COLUMN_CODES.has(code)) return true;
  const normalized = (error.message ?? "").toLowerCase();
  return normalized.includes("health_score") && (normalized.includes("column") || normalized.includes("schema cache"));
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

const extractBearerToken = (request: Request) => {
  const headerValue = request.headers.get("authorization");
  if (!headerValue) return null;

  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
};

const getOptionalUser = async (request: Request) => {
  const supabase = await createClient();
  const bearerToken = extractBearerToken(request);
  const {
    data: { user },
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

  return { supabase, user };
};

const countActiveUsersFromAdmin = async (serviceClient: SupabaseClient, sinceDate: Date) => {
  let page = 1;
  let activeUserCount = 0;

  while (page <= MAX_LIST_USERS_PAGES) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      return { count: 0, error };
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      const lastActivity = user.last_sign_in_at ?? user.updated_at ?? null;
      if (isRecentDate(lastActivity, sinceDate)) {
        activeUserCount += 1;
      }
    }

    if (users.length < LIST_USERS_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return { count: activeUserCount, error: null };
};

const countActiveUsers = async (params: {
  scope: MetricScope;
  sinceDate: Date;
  user: UserLike | null;
  serviceClient: SupabaseClient | null;
}) => {
  const { scope, serviceClient, sinceDate, user } = params;

  if (scope === "user") {
    const userLastActivity = user?.last_sign_in_at ?? user?.updated_at ?? null;
    return isRecentDate(userLastActivity, sinceDate) ? 1 : 0;
  }

  if (scope === "global" && serviceClient) {
    const result = await countActiveUsersFromAdmin(serviceClient, sinceDate);
    if (result.error) {
      return 0;
    }
    return result.count;
  }

  return 0;
};

const countTableRows = async (params: {
  client: SupabaseClient;
  table: string;
  userId: string | null;
  allowMissingTable?: boolean;
}) => {
  const { allowMissingTable = false, client, table, userId } = params;
  const tableClient = client as unknown as {
    from: (tableName: string) => {
      select: (columns: string, options: { count: "exact"; head: true }) => {
        eq: (column: string, value: string) => Promise<{ count: number | null; error: { code?: string | null; message?: string | null } | null }>;
      } & Promise<{ count: number | null; error: { code?: string | null; message?: string | null } | null }>;
    };
  };
  const baseQuery = tableClient.from(table).select("id", { count: "exact", head: true });
  const query = userId ? baseQuery.eq("user_id", userId) : baseQuery;
  const { count, error } = await query;

  if (error) {
    if (allowMissingTable && isMissingTableError(error)) {
      return 0;
    }
    throw error;
  }

  return count ?? 0;
};

const calculateFallbackHealthAverage = async (params: {
  client: SupabaseClient;
  userId: string | null;
}) => {
  const { client, userId } = params;

  const assetsTable = client as unknown as {
    from: (tableName: "assets") => {
      select: (columns: string) => {
        order: (column: string, options: { ascending: boolean }) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{ data: AssetRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
        } & Promise<{ data: AssetRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
      };
    };
  };
  const logsTable = client as unknown as {
    from: (tableName: "service_logs") => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ data: ServiceLogRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
      } & Promise<{ data: ServiceLogRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
    };
  };
  const expensesTable = client as unknown as {
    from: (tableName: "expenses") => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ data: ExpenseRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
      } & Promise<{ data: ExpenseRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
    };
  };

  const baseAssetsQuery = assetsTable.from("assets").select("id,name").order("created_at", { ascending: false });
  const baseLogsQuery = logsTable.from("service_logs").select("asset_id,cost");
  const baseExpensesQuery = expensesTable.from("expenses").select("asset_id,amount,category,note");

  const assetsQuery = userId ? baseAssetsQuery.eq("user_id", userId) : baseAssetsQuery;
  const logsQuery = userId ? baseLogsQuery.eq("user_id", userId) : baseLogsQuery;
  const expensesQuery = userId ? baseExpensesQuery.eq("user_id", userId) : baseExpensesQuery;

  const [assetsRes, logsRes, expensesRes] = await Promise.all([assetsQuery, logsQuery, expensesQuery]);

  if (assetsRes.error) throw assetsRes.error;
  if (logsRes.error) throw logsRes.error;

  const assets = ((assetsRes.data ?? []) as AssetRow[]).map((asset) => ({
    id: asset.id,
    name: asset.name ?? "Varlik",
  }));
  if (assets.length === 0) {
    return 0;
  }

  const logs = (logsRes.data ?? []) as ServiceLogRow[];
  const expenses =
    expensesRes.error && isMissingTableError(expensesRes.error)
      ? []
      : ((expensesRes.data ?? []) as ExpenseRow[]);

  const logsByAsset = new Map<string, Array<{ assetId: string; cost: number }>>();
  for (const log of logs) {
    const bucket = logsByAsset.get(log.asset_id) ?? [];
    bucket.push({
      assetId: log.asset_id,
      cost: Number(log.cost ?? 0),
    });
    logsByAsset.set(log.asset_id, bucket);
  }

  const expensesByAsset = new Map<string, Array<{ assetId: string; amount: number; category: string | null; note: string | null }>>();
  for (const expense of expenses) {
    if (!expense.asset_id) continue;
    const bucket = expensesByAsset.get(expense.asset_id) ?? [];
    bucket.push({
      assetId: expense.asset_id,
      amount: Number(expense.amount ?? 0),
      category: expense.category ?? null,
      note: expense.note ?? null,
    });
    expensesByAsset.set(expense.asset_id, bucket);
  }

  const perAssetScores = assets.map((asset) => {
    const score = calculateRatioScore({
      assets: [{ id: asset.id, name: asset.name }],
      logs: logsByAsset.get(asset.id) ?? [],
      expenses: expensesByAsset.get(asset.id) ?? [],
    }).score;

    return clamp(score, 0, 100);
  });

  const total = perAssetScores.reduce((sum, score) => sum + score, 0);
  return total / perAssetScores.length;
};

const calculateSystemHealthRate = async (params: {
  client: SupabaseClient;
  userId: string | null;
}) => {
  const { client, userId } = params;
  const assetsTable = client as unknown as {
    from: (tableName: "assets") => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ data: AssetHealthRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
      } & Promise<{ data: AssetHealthRow[] | null; error: { code?: string | null; message?: string | null } | null }>;
    };
  };
  const baseHealthQuery = assetsTable.from("assets").select("health_score");
  const healthColumnRes = userId ? await baseHealthQuery.eq("user_id", userId) : await baseHealthQuery;

  if (!healthColumnRes.error) {
    const scores = ((healthColumnRes.data ?? []) as AssetHealthRow[])
      .map((row) => Number(row.health_score))
      .filter((value) => Number.isFinite(value));

    if (scores.length === 0) {
      return 0;
    }

    const sum = scores.reduce((acc, value) => acc + value, 0);
    return clamp(sum / scores.length, 0, 100);
  }

  if (!isMissingHealthScoreColumn(healthColumnRes.error)) {
    throw healthColumnRes.error;
  }

  return calculateFallbackHealthAverage({ client, userId });
};

const buildZeroPayload = (): MetricsPayload => ({
  activeUsers: 0,
  trackedAssets: 0,
  completedTransactions: 0,
  systemHealthRate: 0,
  scope: "public_fallback",
  generatedAt: toIso(getNow()),
});

const buildMetrics = async (request: Request): Promise<MetricsPayload> => {
  const { supabase, user } = await getOptionalUser(request);
  const serviceClient = getServiceRoleClient();
  const scope: MetricScope = user ? "user" : serviceClient ? "global" : "public_fallback";

  if (scope === "public_fallback") {
    return buildZeroPayload();
  }

  const client = scope === "global" ? serviceClient! : supabase;
  const userId = scope === "user" ? user!.id : null;

  const sinceDate = new Date(getNow().getTime() - THIRTY_DAYS_MS);

  const [activeUsers, trackedAssets, serviceLogCount, billingInvoiceCount, healthAverage] = await Promise.all([
    countActiveUsers({
      scope,
      sinceDate,
      user: user as UserLike | null,
      serviceClient: scope === "global" ? serviceClient : null,
    }),
    countTableRows({ client, table: "assets", userId }),
    countTableRows({ client, table: "service_logs", userId }),
    countTableRows({ client, table: "billing_invoices", userId, allowMissingTable: true }),
    calculateSystemHealthRate({ client, userId }),
  ]);

  return {
    activeUsers,
    trackedAssets,
    completedTransactions: serviceLogCount + billingInvoiceCount,
    systemHealthRate: Math.round(clamp(healthAverage, 0, 100)),
    scope,
    generatedAt: toIso(getNow()),
  };
};

export async function GET(request: Request) {
  try {
    const metrics = await buildMetrics(request);
    return NextResponse.json(metrics, { status: 200 });
  } catch {
    return NextResponse.json(buildZeroPayload(), { status: 200 });
  }
}
