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

export type GetServiceLogByIdRow = Pick<Row<"service_logs">, "id" | "asset_id" | "user_id" | "notes">;

export type CreateServiceLogParams = {
  values: Insert<"service_logs">;
};

export type CreateServiceLogRow = Pick<Row<"service_logs">, "id">;

export type UpdateServiceLogByIdParams = {
  userId: string;
  serviceLogId: string;
  patch: Update<"service_logs">;
};

export type UpdateServiceLogByIdRow = Pick<Row<"service_logs">, "id">;

export type UpdateServiceLogNotesByIdParams = {
  userId: string;
  serviceLogId: string;
  notes: string | null;
};

export type UpdateServiceLogNotesByIdRow = Pick<Row<"service_logs">, "id">;

export function listForServicesPage(
  _client: DbClient,
  _params: ListServiceLogsForServicesPageParams,
): RepoResult<ListServiceLogsForServicesPageRow[]> {
  throw new Error("not implemented");
}

export function listForCosts(
  _client: DbClient,
  _params: ListServiceLogsForCostsParams,
): RepoResult<ListServiceLogsForCostsRow[]> {
  throw new Error("not implemented");
}

export function listForDashboard(
  _client: DbClient,
  _params: ListServiceLogsForDashboardParams,
): RepoResult<ListServiceLogsForDashboardRow[]> {
  throw new Error("not implemented");
}

export function listForReports(
  _client: DbClient,
  _params: ListServiceLogsForReportsParams,
): RepoResult<ListServiceLogsForReportsRow[]> {
  throw new Error("not implemented");
}

export function listForTimeline(
  _client: DbClient,
  _params: ListServiceLogsForTimelineParams,
): RepoResult<ListServiceLogsForTimelineRow[]> {
  throw new Error("not implemented");
}

export function listForPrediction(
  _client: DbClient,
  _params: ListServiceLogsForPredictionParams,
): RepoResult<ListServiceLogsForPredictionRow[]> {
  throw new Error("not implemented");
}

export function countByAsset(
  _client: DbClient,
  _params: CountServiceLogsByAssetParams,
): RepoResult<number> {
  throw new Error("not implemented");
}

export function getById(
  _client: DbClient,
  _params: GetServiceLogByIdParams,
): RepoResult<GetServiceLogByIdRow> {
  throw new Error("not implemented");
}

export function create(
  _client: DbClient,
  _params: CreateServiceLogParams,
): RepoResult<CreateServiceLogRow> {
  throw new Error("not implemented");
}

export function updateById(
  _client: DbClient,
  _params: UpdateServiceLogByIdParams,
): RepoResult<UpdateServiceLogByIdRow> {
  throw new Error("not implemented");
}

export function updateNotesById(
  _client: DbClient,
  _params: UpdateServiceLogNotesByIdParams,
): RepoResult<UpdateServiceLogNotesByIdRow> {
  throw new Error("not implemented");
}
