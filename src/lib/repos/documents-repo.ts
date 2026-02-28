import type { PostgrestError } from "@supabase/supabase-js";
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
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export type ReportsDocumentsCursor = {
  uploadedAt: string;
  id: string;
};

export type ListDocumentsForReportsPaginatedParams = {
  userId: string;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  cursor?: ReportsDocumentsCursor | null;
};

export type ListDocumentsForReportsPaginatedResult = {
  rows: ListDocumentsForReportsWithAssetRow[];
  nextCursor: ReportsDocumentsCursor | null;
  hasMore: boolean;
};

export type ListDocumentsForReportsRow = Pick<Row<"documents">, "id" | "asset_id" | "file_name" | "uploaded_at">;
export type ListDocumentsForReportsWithAssetRow = ListDocumentsForReportsRow & {
  asset_name: string | null;
};

type ReportAssetRelation = { name: string | null } | { name: string | null }[] | null;
type ListDocumentsForReportsRawRow = Pick<Row<"documents">, "id" | "asset_id" | "file_name" | "uploaded_at"> & {
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

export type SumDocumentStorageByUserParams = {
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
  client: DbClient,
  params: ListDocumentsForDocumentsPageParams,
): RepoResult<ListDocumentsForDocumentsPageRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("documents")
      .select("id,asset_id,document_type,file_name,storage_path,file_size,uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListDocumentsForDocumentsPageRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listForReports(
  client: DbClient,
  params: ListDocumentsForReportsParams,
): RepoResult<ListDocumentsForReportsWithAssetRow[]> {
  const { userId } = params;
  const limit = normalizePageSize(params.limit, 100);
  const offset = normalizeOffset(params.offset);

  let query = client
    .from("documents")
    .select("id,asset_id,file_name,uploaded_at,asset:assets(name)")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (params.startDate) {
    query = query.gte("uploaded_at", `${params.startDate}T00:00:00`);
  }
  if (params.endDate) {
    query = query.lte("uploaded_at", `${params.endDate}T23:59:59.999`);
  }

  query = query.range(offset, offset + limit - 1);

  return Promise.resolve(query).then((r) => ({
    data:
      ((r.data as ListDocumentsForReportsRawRow[] | null) ?? []).map((row) => ({
        id: row.id,
        asset_id: row.asset_id,
        file_name: row.file_name,
        uploaded_at: row.uploaded_at,
        asset_name: getReportAssetName(row.asset),
      })) ?? [],
    error: r.error,
  }));
}

export function listForReportsPaginated(
  client: DbClient,
  params: ListDocumentsForReportsPaginatedParams,
): RepoResult<ListDocumentsForReportsPaginatedResult> {
  const pageSize = normalizePageSize(params.pageSize, 100, 200);
  const cursor = params.cursor ?? null;

  let query = client
    .from("documents")
    .select("id,asset_id,file_name,uploaded_at,asset:assets(name)")
    .eq("user_id", params.userId)
    .order("uploaded_at", { ascending: false })
    .order("id", { ascending: false });

  if (params.startDate) {
    query = query.gte("uploaded_at", `${params.startDate}T00:00:00`);
  }
  if (params.endDate) {
    query = query.lte("uploaded_at", `${params.endDate}T23:59:59.999`);
  }
  if (cursor?.uploadedAt && cursor.id) {
    query = query.or(
      `uploaded_at.lt.${cursor.uploadedAt},and(uploaded_at.eq.${cursor.uploadedAt},id.lt.${cursor.id})`,
    );
  }

  query = query.limit(pageSize + 1);

  return Promise.resolve(query).then((r) => {
    const rows = ((r.data as ListDocumentsForReportsRawRow[] | null) ?? []).map((row) => ({
      id: row.id,
      asset_id: row.asset_id,
      file_name: row.file_name,
      uploaded_at: row.uploaded_at,
      asset_name: getReportAssetName(row.asset),
    }));

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1] ?? null;

    return {
      data: {
        rows: pageRows,
        hasMore,
        nextCursor: hasMore && lastRow ? { uploadedAt: lastRow.uploaded_at, id: lastRow.id } : null,
      },
      error: r.error,
    };
  });
}

export function listForTimeline(
  client: DbClient,
  params: ListDocumentsForTimelineParams,
): RepoResult<ListDocumentsForTimelineRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("documents")
      .select("id,asset_id,file_name,uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListDocumentsForTimelineRow[] | null) ?? [],
    error: r.error,
  }));
}

export function countByAsset(
  client: DbClient,
  params: CountDocumentsByAssetParams,
): RepoResult<number> {
  const { assetId, userId } = params;

  return Promise.resolve(
    client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("asset_id", assetId),
  ).then((r) => ({
    data: r.count ?? 0,
    error: r.error,
  }));
}

export function countByUser(
  client: DbClient,
  params: CountDocumentsByUserParams,
): RepoResult<number> {
  const { userId } = params;

  return Promise.resolve(
    client.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ).then((r) => ({
    data: r.count ?? 0,
    error: r.error,
  }));
}

export function sumFileSizeByUser(
  client: DbClient,
  params: SumDocumentStorageByUserParams,
): RepoResult<number> {
  const { userId } = params;

  return Promise.resolve(
    client.from("documents").select("file_size").eq("user_id", userId),
  ).then((r) => ({
    data:
      ((r.data as Array<{ file_size: number | null }> | null) ?? []).reduce((sum, row) => {
        const fileSize = Number(row.file_size ?? 0);
        return sum + (Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 0);
      }, 0) ?? 0,
    error: r.error,
  }));
}

export function create(
  client: DbClient,
  params: CreateDocumentParams,
): RepoResult<CreateDocumentRow> {
  const { values } = params;
  const table = client.from("documents") as unknown as {
    insert: (insertValues: CreateDocumentParams["values"]) => {
      select: (columns: "id") => {
        single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
      };
    };
  };

  return Promise.resolve(
    table.insert(values).select("id").single(),
  ).then((r) => ({
    data: (r.data as CreateDocumentRow | null) ?? null,
    error: r.error,
  }));
}

export function updateById(
  client: DbClient,
  params: UpdateDocumentByIdParams,
): RepoResult<UpdateDocumentByIdRow> {
  const { documentId, patch, userId } = params;
  const table = client.from("documents") as unknown as {
    update: (updateValues: UpdateDocumentByIdParams["patch"]) => {
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
      .update(patch)
      .eq("id", documentId)
      .eq("user_id", userId)
      .select("id")
      .single(),
  ).then((r) => ({
    data: (r.data as UpdateDocumentByIdRow | null) ?? null,
    error: r.error,
  }));
}
