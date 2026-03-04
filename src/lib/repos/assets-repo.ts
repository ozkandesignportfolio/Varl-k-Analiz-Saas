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

type RpcPrimitive = string | number | boolean | null;
type RpcArgValue = RpcPrimitive | RpcPrimitive[];
type RpcArgs = Record<string, RpcArgValue>;
type RpcResponse<T> = { data: T | null; error: PostgrestError | null };
type RpcInvoker = <T>(fn: string, args?: RpcArgs) => PromiseLike<RpcResponse<T>>;

type ListAssetCategoriesRpcRow = {
  category: string | null;
};

type ListAssetsPageRpcRow = {
  id: string | null;
  name: string | null;
  category: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code: string | null;
  created_at: string | null;
  updated_at: string | null;
  next_maintenance_date: string | null;
  last_service_date: string | null;
  document_count: number | string | null;
  total_cost: number | string | null;
  warranty_state: string | null;
  maintenance_state: string | null;
  asset_state: string | null;
  score: number | string | null;
  cursor_value: string | null;
};

const asRpcInvoker = (client: DbClient): RpcInvoker => client.rpc.bind(client) as RpcInvoker;
const fallbackSelectWithQrCode =
  "id,name,category,serial_number,brand,model,purchase_date,warranty_end_date,photo_path,qr_code,created_at,updated_at";
const fallbackSelectWithoutQrCode =
  "id,name,category,serial_number,brand,model,purchase_date,warranty_end_date,photo_path,created_at,updated_at";

const toFiniteNumber = (value: number | string | null, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveWarrantyState = (value: string | null): ListAssetsRow["warranty_state"] =>
  value === "active" || value === "expiring" || value === "expired" ? value : "active";

const resolveMaintenanceState = (value: string | null): ListAssetsRow["maintenance_state"] =>
  value === "none" || value === "scheduled" || value === "upcoming" || value === "overdue"
    ? value
    : "none";

const resolveAssetState = (value: string | null): ListAssetsRow["asset_state"] =>
  value === "active" || value === "passive" ? value : "active";

const normalizePageSize = (value: number | undefined, fallback: number, max = 200) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const parsed = Math.floor(value);
  if (parsed <= 0) return fallback;
  return Math.min(max, parsed);
};

const isMissingQrCodeColumnError = (error: PostgrestError | null) => {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("qr_code") &&
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      message.includes("could not find the column"))
  );
};

type FallbackAssetRow = {
  id: string | null;
  name: string | null;
  category: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const fallbackWarrantyState = (warrantyEndDate: string | null): ListAssetsRow["warranty_state"] => {
  if (!warrantyEndDate) return "active";

  const warrantyDate = new Date(warrantyEndDate);
  if (Number.isNaN(warrantyDate.getTime())) return "active";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  warrantyDate.setHours(0, 0, 0, 0);

  if (warrantyDate < now) return "expired";

  const dayDiff = Math.floor((warrantyDate.getTime() - now.getTime()) / 86_400_000);
  return dayDiff <= 45 ? "expiring" : "active";
};

const fallbackScore = (warrantyState: ListAssetsRow["warranty_state"]) => {
  if (warrantyState === "expired") return 55;
  if (warrantyState === "expiring") return 75;
  return 90;
};

const mapRpcRows = (rows: ListAssetsPageRpcRow[]): ListAssetsRow[] =>
  rows.map((row): ListAssetsRow => ({
    id: row.id ?? "",
    name: row.name ?? "",
    category: row.category ?? "",
    serial_number: row.serial_number,
    brand: row.brand,
    model: row.model,
    purchase_date: row.purchase_date,
    warranty_end_date: row.warranty_end_date,
    photo_path: row.photo_path,
    qr_code: row.qr_code ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    next_maintenance_date: row.next_maintenance_date,
    last_service_date: row.last_service_date,
    document_count: toFiniteNumber(row.document_count),
    total_cost: toFiniteNumber(row.total_cost),
    warranty_state: resolveWarrantyState(row.warranty_state),
    maintenance_state: resolveMaintenanceState(row.maintenance_state),
    asset_state: resolveAssetState(row.asset_state),
    score: toFiniteNumber(row.score),
    cursor_value: row.cursor_value ?? "",
  }));

const buildPagedResult = (rows: ListAssetsRow[], pageSize: number, sort: AssetSortMode): ListAssetsResult => {
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = pageRows[pageRows.length - 1] ?? null;

  return {
    rows: pageRows,
    hasMore,
    nextCursor: hasMore && lastRow ? { value: lastRow.cursor_value, id: lastRow.id, sort } : null,
  };
};

const listAssetsFallback = async (
  client: DbClient,
  params: ListAssetsParams,
  pageSize: number,
): Promise<{ data: ListAssetsResult; error: PostgrestError | null }> => {
  const fallbackSort = "updated";

  const buildQuery = (selectColumns: string) => {
    let query = client.from("assets").select(selectColumns).eq("user_id", params.userId);

    const searchTerm = params.search?.trim();
    if (searchTerm) {
      query = query.ilike("name", `%${searchTerm}%`);
    }

    if (params.category && params.category !== "all") {
      query = query.eq("category", params.category);
    }

    if (params.cursor?.sort === fallbackSort && params.cursor.value) {
      query = query.lt("updated_at", params.cursor.value);
    }

    return query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize + 1);
  };

  const primary = await Promise.resolve(buildQuery(fallbackSelectWithQrCode));
  if (primary.error && isMissingQrCodeColumnError(primary.error)) {
    const legacy = await Promise.resolve(buildQuery(fallbackSelectWithoutQrCode));
    const legacyRows = (legacy.data as FallbackAssetRow[] | null) ?? [];
    const mappedRows = legacyRows.map((row): ListAssetsRow => {
      const warrantyState = fallbackWarrantyState(row.warranty_end_date);
      return {
        id: row.id ?? "",
        name: row.name ?? "",
        category: row.category ?? "",
        serial_number: row.serial_number,
        brand: row.brand,
        model: row.model,
        purchase_date: row.purchase_date,
        warranty_end_date: row.warranty_end_date,
        photo_path: row.photo_path,
        qr_code: "",
        created_at: row.created_at ?? "",
        updated_at: row.updated_at ?? "",
        next_maintenance_date: null,
        last_service_date: null,
        document_count: 0,
        total_cost: 0,
        warranty_state: warrantyState,
        maintenance_state: "none",
        asset_state: "active",
        score: fallbackScore(warrantyState),
        cursor_value: row.updated_at ?? row.created_at ?? "",
      };
    });

    return {
      data: buildPagedResult(mappedRows, pageSize, fallbackSort),
      error: legacy.error,
    };
  }

  const primaryRows = (primary.data as FallbackAssetRow[] | null) ?? [];
  const mappedRows = primaryRows.map((row): ListAssetsRow => {
    const warrantyState = fallbackWarrantyState(row.warranty_end_date);
    return {
      id: row.id ?? "",
      name: row.name ?? "",
      category: row.category ?? "",
      serial_number: row.serial_number,
      brand: row.brand,
      model: row.model,
      purchase_date: row.purchase_date,
      warranty_end_date: row.warranty_end_date,
      photo_path: row.photo_path,
      qr_code: row.qr_code ?? "",
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
      next_maintenance_date: null,
      last_service_date: null,
      document_count: 0,
      total_cost: 0,
      warranty_state: warrantyState,
      maintenance_state: "none",
      asset_state: "active",
      score: fallbackScore(warrantyState),
      cursor_value: row.updated_at ?? row.created_at ?? "",
    };
  });

  return {
    data: buildPagedResult(mappedRows, pageSize, fallbackSort),
    error: primary.error,
  };
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
  const rpc = asRpcInvoker(client);

  return Promise.resolve(
    rpc<ListAssetCategoriesRpcRow[]>("list_asset_categories", {
      p_user_id: params.userId,
    }),
  ).then((r) => ({
    data: ((r.data ?? [])
      .map((row) => row.category?.trim() ?? "")
      .filter((value) => value.length > 0)),
    error: r.error,
  }));
}

export function listAssets(
  client: DbClient,
  params: ListAssetsParams,
): RepoResult<ListAssetsResult> {
  const rpc = asRpcInvoker(client);

  const pageSize = normalizePageSize(params.pageSize, 30, 100);
  const sort = params.sort ?? "updated";
  const cursor = params.cursor && params.cursor.sort === sort ? params.cursor : null;

  return Promise.resolve(
    rpc<ListAssetsPageRpcRow[]>("list_assets_page", {
      p_user_id: params.userId,
      p_cursor_value: cursor?.value ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_page_size: pageSize + 1,
      p_search: params.search?.trim() || null,
      p_category: params.category && params.category !== "all" ? params.category : null,
      p_asset_filter: params.assetFilter && params.assetFilter !== "all" ? params.assetFilter : null,
      p_warranty_filter:
        params.warrantyFilter && params.warrantyFilter !== "all" ? params.warrantyFilter : null,
      p_maintenance_filter:
        params.maintenanceFilter && params.maintenanceFilter !== "all"
          ? params.maintenanceFilter
          : null,
      p_sort: sort,
    }),
  ).then(async (r) => {
    if (r.error) {
      const fallback = await listAssetsFallback(client, params, pageSize);
      return {
        data: fallback.data,
        error: fallback.error,
      };
    }

    const rows = mapRpcRows(r.data ?? []);
    return {
      data: buildPagedResult(rows, pageSize, sort),
      error: null,
    };
  });
}
