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
