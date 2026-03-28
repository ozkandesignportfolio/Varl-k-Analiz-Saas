import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListServiceLogsForServicesPageParams = {
  userId: string;
  assetId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export type ServiceLogsCursor = {
  createdAt: string;
  id: string;
};

export type ListServicesParams = {
  userId: string;
  cursor?: ServiceLogsCursor | null;
  pageSize?: number;
  filters?: {
    assetId?: string;
    startDate?: string;
    endDate?: string;
  };
};

export type ListServicesResult = {
  rows: ListServiceLogsForServicesPageRow[];
  nextCursor: ServiceLogsCursor | null;
  hasMore: boolean;
};

export type ListServiceLogsForServicesPageRow = Pick<
  Row<"service_logs">,
  | "id"
  | "asset_id"
  | "rule_id"
  | "service_type"
  | "service_date"
  | "cost"
  | "provider"
  | "notes"
  | "created_at"
>;

export type ListServiceLogsForCostsParams = {
  userId: string;
};

export type ListServiceLogsForCostsRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "service_date" | "cost"
>;

export type GetServiceLogCostAggregateParams = {
  userId: string;
  sinceDate?: string;
  beforeDate?: string;
};

export type ServiceLogCostAggregate = {
  total_cost: number;
  log_count: number;
  avg_cost: number;
  cost_score: number;
};

export type ListServiceLogsForDashboardParams = {
  userId: string;
  sinceDate?: string;
  limit?: number;
};

export type ListServiceLogsForDashboardRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "rule_id" | "service_type" | "service_date" | "cost"
>;

export type ListServiceLogsForReportsParams = {
  userId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export type ReportsServiceLogsCursor = {
  createdAt: string;
  id: string;
};

export type ListServiceLogsForReportsPaginatedParams = {
  userId: string;
  cursor?: ReportsServiceLogsCursor | null;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
};

export type ListServiceLogsForReportsPaginatedResult = {
  rows: ListServiceLogsForReportsRow[];
  nextCursor: ReportsServiceLogsCursor | null;
  hasMore: boolean;
};

export type ListServiceLogsForReportsRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "service_date" | "service_type" | "cost"
> & {
  asset_name: string | null;
};

type ReportAssetRelation = { name: string | null } | { name: string | null }[] | null;
type ListServiceLogsForReportsRawRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "service_date" | "service_type" | "cost"
> & {
  asset: ReportAssetRelation;
};

const getReportAssetName = (relation: ReportAssetRelation): string | null => {
  if (!relation) return null;
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null;
  }
  return relation.name ?? null;
};

const normalizePageSize = (value: number | undefined, fallback: number, max = 200) => {
  if (!Number.isFinite(value)) return fallback;
  const parsed = Math.floor(value as number);
  if (parsed <= 0) return fallback;
  return Math.min(max, parsed);
};

const normalizeOffset = (value: number | undefined) => {
  if (!Number.isFinite(value)) return 0;
  const parsed = Math.floor(value as number);
  return parsed > 0 ? parsed : 0;
};

export type ListServiceLogsForTimelineParams = {
  userId: string;
};

export type ListServiceLogsForTimelineRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "service_type" | "service_date" | "created_at"
>;

export type ListServiceLogsForPredictionParams = {
  userId: string;
  limit: number;
};

export type ListServiceLogsForPredictionRow = Pick<
  Row<"service_logs">,
  "asset_id" | "service_date" | "service_type" | "cost"
>;

export type ListAssetActivityPreviewParams = {
  userId: string;
  assetIds: string[];
  perAssetLimit?: number;
};

export type ListAssetActivityPreviewRow = Pick<
  Row<"service_logs">,
  "asset_id" | "id" | "service_type" | "service_date" | "cost"
>;

export type CountServiceLogsByAssetParams = {
  userId: string;
  assetId: string;
};

export type GetServiceLogByIdParams = {
  userId: string;
  serviceLogId: string;
};

export type GetServiceLogByIdRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "rule_id" | "user_id" | "service_date" | "notes"
>;

export type CreateServiceLogParams = {
  values: Insert<"service_logs">;
};

export type CreateServiceLogRow = Pick<Row<"service_logs">, "id" | "rule_id" | "asset_id" | "service_date">;

export type UpdateServiceLogByIdParams = {
  userId: string;
  serviceLogId: string;
  patch: Update<"service_logs"> & { asset_id?: string; rule_id?: string | null };
};

export type UpdateServiceLogByIdRow = Pick<Row<"service_logs">, "id" | "rule_id" | "asset_id" | "service_date">;

export type UpdateServiceLogNotesByIdParams = {
  userId: string;
  serviceLogId: string;
  notes: string | null;
};

export type UpdateServiceLogNotesByIdRow = Pick<Row<"service_logs">, "id">;

export type GetLatestServiceDateForRuleParams = {
  userId: string;
  ruleId: string;
  assetId: string;
};

export type GetLatestServiceDateForRuleRow = Pick<Row<"service_logs">, "service_date">;

export type ListLatestServiceDatesByRulesParams = {
  userId: string;
  ruleIds: string[];
};

export type ListLatestServiceDatesByRulesRow = Pick<
  Row<"service_logs">,
  "rule_id" | "asset_id" | "service_date"
> & {
  rule_id: string;
};

const buildCostAggregate = (rows: Array<{ cost: number | null }>): ServiceLogCostAggregate => {
  const logCount = rows.length;
  const totalCost = rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const avgCost = logCount > 0 ? totalCost / logCount : 0;
  const maxCost = rows.reduce((max, row) => Math.max(max, Number(row.cost ?? 0)), 0);
  const costScore = maxCost > 0 ? Math.round(Math.min(100, (avgCost / maxCost) * 100)) : 0;

  return {
    total_cost: totalCost,
    log_count: logCount,
    avg_cost: avgCost,
    cost_score: costScore,
  };
};

const isListAssetActivityPreviewSignatureError = (error: PostgrestError | null) => {
  if (!error) return false;
  const normalized = error.message.toLowerCase();
  if (!normalized.includes("list_asset_activity_preview")) {
    return false;
  }

  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the function") ||
    normalized.includes("does not exist") ||
    normalized.includes("undefined function")
  );
};

export function listForServicesPage(
  client: DbClient,
  params: ListServiceLogsForServicesPageParams,
): RepoResult<ListServiceLogsForServicesPageRow[]> {
  const { userId } = params;
  const limit = normalizePageSize(params.limit, 50);
  const offset = normalizeOffset(params.offset);

  let query = client
    .from("service_logs")
    .select("id,asset_id,rule_id,service_type,service_date,cost,provider,notes,created_at")
    .eq("user_id", userId)
    .order("service_date", { ascending: false });

  if (params.assetId) {
    query = query.eq("asset_id", params.assetId);
  }
  if (params.startDate) {
    query = query.gte("service_date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("service_date", params.endDate);
  }

  query = query.range(offset, offset + limit - 1);

  return Promise.resolve(query).then((r) => ({
    data: (r.data as ListServiceLogsForServicesPageRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listServices(
  client: DbClient,
  params: ListServicesParams,
): RepoResult<ListServicesResult> {
  const pageSize = normalizePageSize(params.pageSize, 50, 100);
  const cursor = params.cursor ?? null;

  let query = client
    .from("service_logs")
    .select("id,asset_id,rule_id,service_type,service_date,cost,provider,notes,created_at")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (params.filters?.assetId) {
    query = query.eq("asset_id", params.filters.assetId);
  }
  if (params.filters?.startDate) {
    query = query.gte("service_date", params.filters.startDate);
  }
  if (params.filters?.endDate) {
    query = query.lte("service_date", params.filters.endDate);
  }

  if (cursor?.createdAt && cursor.id) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  query = query.limit(pageSize + 1);

  return Promise.resolve(query).then((r) => {
    const rows = (r.data as ListServiceLogsForServicesPageRow[] | null) ?? [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1] ?? null;

    return {
      data: {
        rows: pageRows,
        hasMore,
        nextCursor: hasMore && lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null,
      },
      error: r.error,
    };
  });
}

export function listForCosts(
  client: DbClient,
  params: ListServiceLogsForCostsParams,
): RepoResult<ListServiceLogsForCostsRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("id,asset_id,service_date,cost")
      .eq("user_id", userId)
      .order("service_date", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListServiceLogsForCostsRow[] | null) ?? [],
    error: r.error,
  }));
}

export function getCostAggregate(
  client: DbClient,
  params: GetServiceLogCostAggregateParams,
): RepoResult<ServiceLogCostAggregate> {
  const { beforeDate, sinceDate, userId } = params;

  let query = client.from("service_logs").select("cost").eq("user_id", userId);

  if (sinceDate) {
    query = query.gte("service_date", sinceDate);
  }

  if (beforeDate) {
    query = query.lt("service_date", beforeDate);
  }

  return Promise.resolve(query).then((r) => ({
    data: buildCostAggregate(((r.data as Array<{ cost: number | null }> | null) ?? [])),
    error: r.error,
  }));
}

export function listForDashboard(
  client: DbClient,
  params: ListServiceLogsForDashboardParams,
): RepoResult<ListServiceLogsForDashboardRow[]> {
  const { limit, sinceDate, userId } = params;

  let query = client
    .from("service_logs")
    .select("id,asset_id,rule_id,service_type,service_date,cost")
    .eq("user_id", userId)
    .order("service_date", { ascending: false });

  if (sinceDate) {
    query = query.gte("service_date", sinceDate);
  }

  if (typeof limit === "number" && Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  return Promise.resolve(query).then((r) => ({
    data: (r.data as ListServiceLogsForDashboardRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listForReports(
  client: DbClient,
  params: ListServiceLogsForReportsParams,
): RepoResult<ListServiceLogsForReportsRow[]> {
  const { userId } = params;
  const limit = normalizePageSize(params.limit, 100);
  const offset = normalizeOffset(params.offset);

  let query = client
    .from("service_logs")
    .select("id,asset_id,service_date,service_type,cost,asset:assets(name)")
    .eq("user_id", userId)
    .order("service_date", { ascending: false });

  if (params.startDate) {
    query = query.gte("service_date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("service_date", params.endDate);
  }

  query = query.range(offset, offset + limit - 1);

  return Promise.resolve(query).then((r) => ({
    data:
      ((r.data as ListServiceLogsForReportsRawRow[] | null) ?? []).map((row) => ({
        id: row.id,
        asset_id: row.asset_id,
        service_date: row.service_date,
        service_type: row.service_type,
        cost: Number.isFinite(Number(row.cost)) ? Number(row.cost) : 0,
        asset_name: getReportAssetName(row.asset),
      })) ?? [],
    error: r.error,
  }));
}

export function listForReportsPaginated(
  client: DbClient,
  params: ListServiceLogsForReportsPaginatedParams,
): RepoResult<ListServiceLogsForReportsPaginatedResult> {
  const pageSize = normalizePageSize(params.pageSize, 100, 200);
  const cursor = params.cursor ?? null;

  let query = client
    .from("service_logs")
    .select("id,asset_id,service_date,service_type,cost,created_at,asset:assets(name)")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (params.startDate) {
    query = query.gte("service_date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("service_date", params.endDate);
  }
  if (cursor?.createdAt && cursor.id) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  query = query.limit(pageSize + 1);

  type PaginatedRawRow = ListServiceLogsForReportsRawRow & Pick<Row<"service_logs">, "created_at">;

  return Promise.resolve(query).then((r) => {
    const rows = ((r.data as PaginatedRawRow[] | null) ?? []).map((row) => ({
      id: row.id,
      asset_id: row.asset_id,
      service_date: row.service_date,
      service_type: row.service_type,
      cost: Number.isFinite(Number(row.cost)) ? Number(row.cost) : 0,
      asset_name: getReportAssetName(row.asset),
      created_at: row.created_at,
    }));

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1] ?? null;

    return {
      data: {
        rows: pageRows.map((row) => ({
          id: row.id,
          asset_id: row.asset_id,
          service_date: row.service_date,
          service_type: row.service_type,
          cost: row.cost,
          asset_name: row.asset_name,
        })),
        hasMore,
        nextCursor: hasMore && lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null,
      },
      error: r.error,
    };
  });
}

export function listForTimeline(
  client: DbClient,
  params: ListServiceLogsForTimelineParams,
): RepoResult<ListServiceLogsForTimelineRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("id,asset_id,service_type,service_date,created_at")
      .eq("user_id", userId)
      .order("service_date", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListServiceLogsForTimelineRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listForPrediction(
  client: DbClient,
  params: ListServiceLogsForPredictionParams,
): RepoResult<ListServiceLogsForPredictionRow[]> {
  const { limit, userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("asset_id,service_date,service_type,cost")
      .eq("user_id", userId)
      .order("service_date", { ascending: false })
      .limit(Math.max(1, limit)),
  ).then((r) => ({
    data: (r.data as ListServiceLogsForPredictionRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listAssetActivityPreview(
  client: DbClient,
  params: ListAssetActivityPreviewParams,
): RepoResult<ListAssetActivityPreviewRow[]> {
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;

  const assetIds = [...new Set(params.assetIds.filter((assetId) => assetId.trim().length > 0))];
  if (assetIds.length === 0) {
    return Promise.resolve({ data: [], error: null });
  }

  const perAssetLimit = Math.max(1, Math.min(10, Math.floor(params.perAssetLimit ?? 3)));

  return Promise.resolve(
    rpc("list_asset_activity_preview", {
      p_user_id: params.userId,
      p_asset_ids: assetIds,
      p_per_asset_limit: perAssetLimit,
    }).then(async (r) => {
      if (!isListAssetActivityPreviewSignatureError(r.error)) {
        return r;
      }

      const fallback = await client
        .from("service_logs")
        .select("asset_id,id,service_type,service_date,cost")
        .eq("user_id", params.userId)
        .in("asset_id", assetIds)
        .order("service_date", { ascending: false });

      return fallback;
    }),
  ).then((r) => {
    const rows = ((r.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      asset_id: String(row.asset_id ?? ""),
      id: String(row.id ?? ""),
      service_type: String(row.service_type ?? ""),
      service_date: String(row.service_date ?? ""),
      cost: Number(row.cost ?? 0),
    }));

    if (!isListAssetActivityPreviewSignatureError(r.error)) {
      if (r.error) {
        return { data: [] as ListAssetActivityPreviewRow[], error: r.error };
      }

      if (!Array.isArray(r.data)) {
        return { data: [] as ListAssetActivityPreviewRow[], error: null };
      }
    }

    const countsByAsset = new Map<string, number>();
    const limitedRows = rows.filter((row) => {
      if (!row.asset_id) return false;
      const nextCount = (countsByAsset.get(row.asset_id) ?? 0) + 1;
      countsByAsset.set(row.asset_id, nextCount);
      return nextCount <= perAssetLimit;
    });

    return {
      data: limitedRows as ListAssetActivityPreviewRow[],
      error: r.error,
    };
  });
}

export function countByAsset(
  client: DbClient,
  params: CountServiceLogsByAssetParams,
): RepoResult<number> {
  const { assetId, userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("asset_id", assetId),
  ).then((r) => ({
    data: r.count ?? 0,
    error: r.error,
  }));
}

export function getById(
  client: DbClient,
  params: GetServiceLogByIdParams,
): RepoResult<GetServiceLogByIdRow> {
  const { serviceLogId, userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("id,asset_id,rule_id,user_id,service_date,notes")
      .eq("id", serviceLogId)
      .eq("user_id", userId)
      .maybeSingle(),
  ).then((r) => ({
    data: (r.data as GetServiceLogByIdRow | null) ?? null,
    error: r.error,
  }));
}

export function create(
  client: DbClient,
  params: CreateServiceLogParams,
): RepoResult<CreateServiceLogRow> {
  const { values } = params;
  const table = client.from("service_logs") as unknown as {
    insert: (insertValues: CreateServiceLogParams["values"]) => {
      select: (columns: "id,rule_id,asset_id,service_date") => {
        single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
      };
    };
  };

  return Promise.resolve(
    table.insert(values).select("id,rule_id,asset_id,service_date").single(),
  ).then((r) => ({
    data: (r.data as CreateServiceLogRow | null) ?? null,
    error: r.error,
  }));
}

export function updateById(
  client: DbClient,
  params: UpdateServiceLogByIdParams,
): RepoResult<UpdateServiceLogByIdRow> {
  const { patch, serviceLogId, userId } = params;
  const table = client.from("service_logs") as unknown as {
    update: (updateValues: UpdateServiceLogByIdParams["patch"]) => {
      eq: (column: "id", value: string) => {
        eq: (userColumn: "user_id", userValue: string) => {
          select: (columns: "id,rule_id,asset_id,service_date") => {
            single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
          };
        };
      };
    };
  };

  return Promise.resolve(
    table
      .update(patch)
      .eq("id", serviceLogId)
      .eq("user_id", userId)
      .select("id,rule_id,asset_id,service_date")
      .single(),
  ).then((r) => ({
    data: (r.data as UpdateServiceLogByIdRow | null) ?? null,
    error: r.error,
  }));
}

export function updateNotesById(
  client: DbClient,
  params: UpdateServiceLogNotesByIdParams,
): RepoResult<UpdateServiceLogNotesByIdRow> {
  const { notes, serviceLogId, userId } = params;
  const table = client.from("service_logs") as unknown as {
    update: (updateValues: { notes: string | null }) => {
      eq: (column: "id", value: string) => {
        eq: (userColumn: "user_id", userValue: string) => {
          select: (columns: "id") => {
            single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
          };
        };
      };
    };
  };

  return Promise.resolve(
    table
      .update({ notes })
      .eq("id", serviceLogId)
      .eq("user_id", userId)
      .select("id")
      .single(),
  ).then((r) => ({
    data: (r.data as UpdateServiceLogNotesByIdRow | null) ?? null,
    error: r.error,
  }));
}

export function getLatestServiceDateForRule(
  client: DbClient,
  params: GetLatestServiceDateForRuleParams,
): RepoResult<GetLatestServiceDateForRuleRow> {
  const { assetId, ruleId, userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("service_date")
      .eq("user_id", userId)
      .eq("asset_id", assetId)
      .eq("rule_id", ruleId)
      .order("service_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ).then((r) => ({
    data: (r.data as GetLatestServiceDateForRuleRow | null) ?? null,
    error: r.error,
  }));
}

export function listLatestServiceDatesByRules(
  client: DbClient,
  params: ListLatestServiceDatesByRulesParams,
): RepoResult<ListLatestServiceDatesByRulesRow[]> {
  const { ruleIds, userId } = params;
  const normalizedRuleIds = [...new Set(ruleIds.filter((ruleId) => ruleId.trim().length > 0))];

  if (normalizedRuleIds.length === 0) {
    return Promise.resolve({ data: [], error: null });
  }

  return Promise.resolve(
    client
      .from("service_logs")
      .select("rule_id,asset_id,service_date")
      .eq("user_id", userId)
      .in("rule_id", normalizedRuleIds)
      .order("service_date", { ascending: false }),
  ).then((r) => {
    const latestByRule = new Map<string, ListLatestServiceDatesByRulesRow>();
    for (const row of (r.data as ListLatestServiceDatesByRulesRow[] | null) ?? []) {
      if (!row.rule_id || latestByRule.has(row.rule_id)) continue;
      latestByRule.set(row.rule_id, row);
    }

    return {
      data: [...latestByRule.values()],
      error: r.error,
    };
  });
}
