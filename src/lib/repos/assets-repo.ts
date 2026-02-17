import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListAssetsForManagementParams = {
  userId: string;
};

export type ListAssetsForManagementRow = Pick<
  Row<"assets">,
  | "id"
  | "name"
  | "category"
  | "brand"
  | "model"
  | "purchase_date"
  | "warranty_end_date"
  | "photo_path"
  | "qr_code"
  | "created_at"
>;

export type ListAssetIdNameParams = {
  userId: string;
};

export type ListAssetIdNameRow = Pick<Row<"assets">, "id" | "name">;

export type ListAssetIdCategoryParams = {
  userId: string;
};

export type ListAssetIdCategoryRow = Pick<Row<"assets">, "id" | "category">;

export type ListAssetIdNameCreatedParams = {
  userId: string;
};

export type ListAssetIdNameCreatedRow = Pick<Row<"assets">, "id" | "name" | "created_at">;

export type ListAssetsForPredictionParams = {
  userId: string;
};

export type ListAssetsForPredictionRow = Pick<
  Row<"assets">,
  "id" | "name" | "category" | "warranty_end_date"
>;

export type GetAssetDetailByIdParams = {
  userId: string;
  assetId: string;
};

export type GetAssetDetailByIdRow = Pick<
  Row<"assets">,
  | "id"
  | "name"
  | "category"
  | "brand"
  | "model"
  | "purchase_date"
  | "warranty_end_date"
  | "photo_path"
  | "qr_code"
  | "created_at"
>;

export type FindAssetIdByQrCodeParams = {
  userId: string;
  qrCode: string;
};

export type FindAssetIdByQrCodeRow = Pick<Row<"assets">, "id">;

export type AssetExistsByIdParams = {
  userId: string;
  assetId: string;
};

export type CreateAssetParams = {
  values: Insert<"assets">;
};

export type CreateAssetRow = Pick<Row<"assets">, "id">;

export type UpdateAssetByIdParams = {
  userId: string;
  assetId: string;
  patch: Update<"assets">;
};

export type UpdateAssetByIdRow = Pick<Row<"assets">, "id">;

export type UpdateAssetPhotoPathParams = {
  assetId: string;
  photoPath: string | null;
};

export type UpdateAssetPhotoPathRow = Pick<Row<"assets">, "id">;

export type DeleteAssetByIdParams = {
  userId: string;
  assetId: string;
};

export type DeleteAssetByIdRow = Pick<Row<"assets">, "id">;

export function listForManagement(
  client: DbClient,
  params: ListAssetsForManagementParams,
): RepoResult<ListAssetsForManagementRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("assets")
      .select(
        "id,name,category,brand,model,purchase_date,warranty_end_date,photo_path,qr_code,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListAssetsForManagementRow[] | null) ?? [],
    error: r.error,
  }));
}

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

export function listIdCategory(
  _client: DbClient,
  _params: ListAssetIdCategoryParams,
): RepoResult<ListAssetIdCategoryRow[]> {
  throw new Error("not implemented");
}

export function listIdNameCreated(
  client: DbClient,
  params: ListAssetIdNameCreatedParams,
): RepoResult<ListAssetIdNameCreatedRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("assets")
      .select("id,name,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListAssetIdNameCreatedRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listForPrediction(
  _client: DbClient,
  _params: ListAssetsForPredictionParams,
): RepoResult<ListAssetsForPredictionRow[]> {
  throw new Error("not implemented");
}

export function getDetailById(
  _client: DbClient,
  _params: GetAssetDetailByIdParams,
): RepoResult<GetAssetDetailByIdRow> {
  throw new Error("not implemented");
}

export function findIdByQrCode(
  _client: DbClient,
  _params: FindAssetIdByQrCodeParams,
): RepoResult<FindAssetIdByQrCodeRow> {
  throw new Error("not implemented");
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
  )
    .then((r) => ({ data: !!r.data, error: r.error }));
}

export function create(
  _client: DbClient,
  _params: CreateAssetParams,
): RepoResult<CreateAssetRow> {
  throw new Error("not implemented");
}

export function updateById(
  _client: DbClient,
  _params: UpdateAssetByIdParams,
): RepoResult<UpdateAssetByIdRow> {
  throw new Error("not implemented");
}

export function updatePhotoPath(
  _client: DbClient,
  _params: UpdateAssetPhotoPathParams,
): RepoResult<UpdateAssetPhotoPathRow> {
  throw new Error("not implemented");
}

export function deleteById(
  _client: DbClient,
  _params: DeleteAssetByIdParams,
): RepoResult<DeleteAssetByIdRow> {
  throw new Error("not implemented");
}
