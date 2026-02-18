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
): RepoResult<ListDocumentsForReportsRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("documents")
      .select("id,asset_id,file_name,uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListDocumentsForReportsRow[] | null) ?? [],
    error: r.error,
  }));
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
