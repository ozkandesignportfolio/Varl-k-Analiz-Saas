import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient, RepoResult, Row } from "./_shared";

export type ListAssetIdNameParams = {
  userId: string;
};

export type ListAssetIdNameRow = Pick<Row<"assets">, "id" | "name">;

export type AssetExistsByIdParams = {
  userId: string;
  assetId: string;
};

export type CountAssetsByUserParams = {
  userId: string;
};

export type ListAssetCategoriesParams = {
  userId: string;
};

export type AssetSortMode = "updated" | "cost" | "score";
export type AssetFilterMode = "all" | "active" | "passive";
export type WarrantyFilterMode = "all" | "active" | "expiring" | "expired";
export type MaintenanceFilterMode = "all" | "upcoming" | "overdue";

export type AssetsCursor = {
  value: string;
  id: string;
  sort: AssetSortMode;
};

export type ListAssetsParams = {
  userId: string;
  cursor?: AssetsCursor | null;
  pageSize?: number;
  search?: string;
  sort?: AssetSortMode;
  category?: string;
  assetFilter?: AssetFilterMode;
  warrantyFilter?: WarrantyFilterMode;
  maintenanceFilter?: MaintenanceFilterMode;
};

export type ListAssetsRow = Pick<
  Row<"assets">,
  | "id"
  | "name"
  | "category"
  | "serial_number"
  | "brand"
  | "model"
  | "purchase_date"
  | "warranty_end_date"
  | "photo_path"
  | "qr_code"
  | "created_at"
  | "updated_at"
> & {
  next_maintenance_date: string | null;
  last_service_date: string | null;
  document_count: number;
  total_cost: number;
  warranty_state: "active" | "expiring" | "expired";
  maintenance_state: "none" | "scheduled" | "upcoming" | "overdue";
  asset_state: "active" | "passive";
  score: number;
  cursor_value: string;
};

export type ListAssetsResult = {
  rows: ListAssetsRow[];
  nextCursor: AssetsCursor | null;
  hasMore: boolean;
};

const normalizePageSize = (value: number | undefined, fallback: number, max = 200) => {
  if (!Number.isFinite(value)) return fallback;
  const parsed = Math.floor(value as number);
  if (parsed <= 0) return fallback;
  return Math.min(max, parsed);
};

const isListAssetsSignatureError = (error: PostgrestError | null) => {
  if (!error) return false;
  const normalized = error.message.toLowerCase();
  return error.code === "PGRST202" && normalized.includes("could not find the function public.list_assets_page");
};

export function listIdName(
  client: DbClient,
  params: ListAssetIdNameParams,
): RepoResult<ListAssetIdNameRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("assets")
      .select("id,name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListAssetIdNameRow[] | null) ?? [],
    error: r.error,
  }));
}

export function existsById(
  client: DbClient,
  params: AssetExistsByIdParams,
): RepoResult<boolean> {
  const { assetId, userId } = params;

  return Promise.resolve(
    client
      .from("assets")
      .select("id")
      .eq("id", assetId)
      .eq("user_id", userId)
      .maybeSingle(),
  ).then((r) => ({ data: !!r.data, error: r.error }));
}

export function countByUser(
  client: DbClient,
  params: CountAssetsByUserParams,
): RepoResult<number> {
  const { userId } = params;

  return Promise.resolve(
    client.from("assets").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ).then((r) => ({
    data: r.count ?? 0,
    error: r.error,
  }));
}

export function listCategories(
  client: DbClient,
  params: ListAssetCategoriesParams,
): RepoResult<string[]> {
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;

  return Promise.resolve(
    rpc("list_asset_categories", {
      p_user_id: params.userId,
    }),
  ).then((r) => ({
    data: (((r.data as Array<{ category: string | null }> | null) ?? [])
      .map((row) => row.category?.trim() ?? "")
      .filter((value) => value.length > 0) ?? []) as string[],
    error: r.error,
  }));
}

export function listAssets(
  client: DbClient,
  params: ListAssetsParams,
): RepoResult<ListAssetsResult> {
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;

  const pageSize = normalizePageSize(params.pageSize, 30, 100);
  const sort = params.sort ?? "updated";
  const cursor = params.cursor && params.cursor.sort === sort ? params.cursor : null;
  const searchValue = params.search?.trim() || null;
  const buildRpcArgs = (includeSort: boolean) => ({
    p_user_id: params.userId,
    p_cursor_value: cursor?.value ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_page_size: pageSize + 1,
    p_search: searchValue,
    p_category: params.category && params.category !== "all" ? params.category : null,
    p_asset_filter: params.assetFilter && params.assetFilter !== "all" ? params.assetFilter : null,
    p_warranty_filter:
      params.warrantyFilter && params.warrantyFilter !== "all" ? params.warrantyFilter : null,
    p_maintenance_filter:
      params.maintenanceFilter && params.maintenanceFilter !== "all"
        ? params.maintenanceFilter
        : null,
    ...(includeSort ? { p_sort: sort } : {}),
  });
  const buildLegacyRpcArgs = () => ({
    p_user_id: params.userId,
    p_cursor: cursor?.value || null,
    p_page_size: pageSize + 1,
    p_search: searchValue,
  });
  type ListAssetsRpcResult = {
    data: unknown;
    error: PostgrestError | null;
    effectiveSort: AssetSortMode;
  };

  return Promise.resolve(
    rpc("list_assets_page", buildRpcArgs(true)).then(async (result) => {
      if (isListAssetsSignatureError(result.error)) {
        // temporary compatibility until migration applied
        const noSortResult = await rpc("list_assets_page", buildRpcArgs(false));
        if (!noSortResult.error) {
          return { ...noSortResult, effectiveSort: "updated" } as ListAssetsRpcResult;
        }

        if (isListAssetsSignatureError(noSortResult.error)) {
          const legacyResult = await rpc("list_assets_page", buildLegacyRpcArgs());
          return { ...legacyResult, effectiveSort: "updated" } as ListAssetsRpcResult;
        }

        return { ...noSortResult, effectiveSort: "updated" } as ListAssetsRpcResult;
      }

      return { ...result, effectiveSort: sort } as ListAssetsRpcResult;
    }),
  ).then((r) => {
    const rows = ((r.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      category: String(row.category ?? ""),
      serial_number: (row.serial_number as string | null) ?? null,
      brand: (row.brand as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      purchase_date: (row.purchase_date as string | null) ?? null,
      warranty_end_date: (row.warranty_end_date as string | null) ?? null,
      photo_path: (row.photo_path as string | null) ?? null,
      qr_code: (row.qr_code as string | null) ?? null,
      created_at: String(row.created_at ?? row.updated_at ?? ""),
      updated_at: String(row.updated_at ?? row.created_at ?? ""),
      next_maintenance_date: (row.next_maintenance_date as string | null) ?? null,
      last_service_date: (row.last_service_date as string | null) ?? null,
      document_count: Number(row.document_count ?? 0),
      total_cost: Number(row.total_cost ?? 0),
      warranty_state:
        ((row.warranty_state as string | null) ?? "active") as ListAssetsRow["warranty_state"],
      maintenance_state:
        ((row.maintenance_state as string | null) ?? "none") as ListAssetsRow["maintenance_state"],
      asset_state: ((row.asset_state as string | null) ?? "active") as ListAssetsRow["asset_state"],
      score: Number(row.score ?? 0),
      cursor_value: String(row.cursor_value ?? row.updated_at ?? row.created_at ?? ""),
    })) as ListAssetsRow[];

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const lastRow = pageRows[pageRows.length - 1] ?? null;

    return {
      data: {
        rows: pageRows,
        hasMore,
        nextCursor:
          hasMore && lastRow
            ? { value: lastRow.cursor_value, id: lastRow.id, sort: r.effectiveSort }
            : null,
      },
      error: r.error,
    };
  });
}
