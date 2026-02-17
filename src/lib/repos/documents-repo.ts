import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListDocumentsForDocumentsPageParams = {
  userId: string;
};

export type ListDocumentsForDocumentsPageRow = Pick<
  Row<"documents">,
  "id" | "asset_id" | "document_type" | "file_name" | "storage_path" | "file_size" | "uploaded_at"
>;

export type ListDocumentsForReportsParams = {
  userId: string;
};

export type ListDocumentsForReportsRow = Pick<Row<"documents">, "id" | "asset_id" | "file_name" | "uploaded_at">;

export type ListDocumentsForTimelineParams = {
  userId: string;
};

export type ListDocumentsForTimelineRow = Pick<Row<"documents">, "id" | "asset_id" | "file_name" | "uploaded_at">;

export type CountDocumentsByAssetParams = {
  userId: string;
  assetId: string;
};

export type CountDocumentsByUserParams = {
  userId: string;
};

export type CreateDocumentParams = {
  values: Insert<"documents">;
};

export type CreateDocumentRow = Pick<Row<"documents">, "id">;

export type UpdateDocumentByIdParams = {
  userId: string;
  documentId: string;
  patch: Update<"documents">;
};

export type UpdateDocumentByIdRow = Pick<Row<"documents">, "id">;

export function listForDocumentsPage(
  _client: DbClient,
  _params: ListDocumentsForDocumentsPageParams,
): RepoResult<ListDocumentsForDocumentsPageRow[]> {
  throw new Error("not implemented");
}

export function listForReports(
  _client: DbClient,
  _params: ListDocumentsForReportsParams,
): RepoResult<ListDocumentsForReportsRow[]> {
  throw new Error("not implemented");
}

export function listForTimeline(
  _client: DbClient,
  _params: ListDocumentsForTimelineParams,
): RepoResult<ListDocumentsForTimelineRow[]> {
  throw new Error("not implemented");
}

export function countByAsset(
  _client: DbClient,
  _params: CountDocumentsByAssetParams,
): RepoResult<number> {
  throw new Error("not implemented");
}

export function countByUser(
  _client: DbClient,
  _params: CountDocumentsByUserParams,
): RepoResult<number> {
  throw new Error("not implemented");
}

export function create(
  _client: DbClient,
  _params: CreateDocumentParams,
): RepoResult<CreateDocumentRow> {
  throw new Error("not implemented");
}

export function updateById(
  _client: DbClient,
  _params: UpdateDocumentByIdParams,
): RepoResult<UpdateDocumentByIdRow> {
  throw new Error("not implemented");
}
