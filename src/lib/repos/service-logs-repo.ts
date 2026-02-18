import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListServiceLogsForServicesPageParams = {
  userId: string;
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
};

export type ListServiceLogsForReportsRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "service_date" | "service_type" | "cost"
>;

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

export function listForServicesPage(
  client: DbClient,
  params: ListServiceLogsForServicesPageParams,
): RepoResult<ListServiceLogsForServicesPageRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("service_logs")
      .select("id,asset_id,rule_id,service_type,service_date,cost,provider,notes,created_at")
      .eq("user_id", userId)
      .order("service_date", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListServiceLogsForServicesPageRow[] | null) ?? [],
    error: r.error,
  }));
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

  return Promise.resolve(
    client
      .from("service_logs")
      .select("id,asset_id,service_date,service_type,cost")
      .eq("user_id", userId)
      .order("service_date", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListServiceLogsForReportsRow[] | null) ?? [],
    error: r.error,
  }));
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
