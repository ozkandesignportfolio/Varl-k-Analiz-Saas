import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetActivityItem,
  AssetDashboardRow,
} from "@/features/assets/components/assets-view-types";
import { ASSET_MEDIA_BUCKET } from "@/lib/assets/media-limits";
import {
  countByUser as countAssetsByUser,
  listCategories as listAssetCategories,
  type AssetsCursor,
  type ListAssetsRow,
} from "@/lib/repos/assets-repo";
import { listAssetActivityPreview } from "@/lib/repos/service-logs-repo";
import type { AssetsListQueryOptions } from "@/features/assets/hooks/useAssetsFilters";

type UseAssetsDataArgs = {
  supabase: SupabaseClient;
  setAssetCount: (count: number) => void;
  userId: string;
  listQueryOptions: AssetsListQueryOptions;
};

type AssetMediaListRow = {
  asset_id: string;
  type: string;
  storage_path: string;
};

type ListAssetsPageResponse = {
  rows: ListAssetsRow[];
  nextCursor: AssetsCursor | null;
  hasMore: boolean;
};

const LEGACY_PHOTO_BUCKET = "documents-private";
const THUMBNAIL_BUCKET_FALLBACK_ORDER = [ASSET_MEDIA_BUCKET, LEGACY_PHOTO_BUCKET] as const;
const ASSETS_PAGE_SIZE = 30;

const isMissingQrCodeError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("qr_code") &&
    (normalized.includes("does not exist") || normalized.includes("could not find the column"))
  );
};

const isMissingAssetMediaError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("asset_media") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
};

const asIsoDate = (value: string | null) => (value ? value.slice(0, 10) : null);

const toListAssetsPageResponse = (payload: unknown): ListAssetsPageResponse => {
  const payloadObject = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const nestedData = payloadObject?.data;

  const fromTopLevel = payloadObject && "rows" in payloadObject ? (payloadObject as ListAssetsPageResponse) : null;
  const fromDataField =
    nestedData && typeof nestedData === "object" && "rows" in nestedData
      ? (nestedData as ListAssetsPageResponse)
      : null;

  const source = fromTopLevel ?? fromDataField;
  if (!source) {
    return { rows: [], nextCursor: null, hasMore: false };
  }

  return {
    rows: source.rows ?? [],
    nextCursor: source.nextCursor ?? null,
    hasMore: source.hasMore ?? false,
  };
};

export function useAssetsData({ supabase, setAssetCount, userId, listQueryOptions }: UseAssetsDataArgs) {
  const [assets, setAssets] = useState<ListAssetsRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalAssetCount, setTotalAssetCount] = useState(0);
  const [assetsCursor, setAssetsCursor] = useState<AssetsCursor | null>(null);
  const [hasMoreAssets, setHasMoreAssets] = useState(false);
  const [isLoadingMoreAssets, setIsLoadingMoreAssets] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [serviceActivityPreviewByAsset, setServiceActivityPreviewByAsset] = useState<
    Record<string, AssetActivityItem[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const refreshAssetCount = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await countAssetsByUser(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      const count = data ?? 0;
      setTotalAssetCount(count);
      setAssetCount(count);
    },
    [setAssetCount, supabase],
  );

  const fetchCategoryOptions = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listAssetCategories(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      setCategories(data ?? []);
    },
    [supabase],
  );

  const fetchAssetActivityPreview = useCallback(
    async (currentUserId: string, assetRows: ListAssetsRow[], options?: { append?: boolean }) => {
      const append = options?.append === true;
      if (assetRows.length === 0) {
        if (!append) setServiceActivityPreviewByAsset({});
        return;
      }

      const assetIds = assetRows.map((asset) => asset.id);
      const { data, error } = await listAssetActivityPreview(supabase, {
        userId: currentUserId,
        assetIds,
        perAssetLimit: 3,
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      const grouped = new Map<string, AssetActivityItem[]>();
      for (const row of data ?? []) {
        const list = grouped.get(row.asset_id) ?? [];
        list.push({
          id: row.id,
          serviceType: row.service_type,
          serviceDate: row.service_date,
          cost: Number(row.cost ?? 0),
        });
        grouped.set(row.asset_id, list);
      }

      const nextMap: Record<string, AssetActivityItem[]> = {};
      for (const [key, value] of grouped.entries()) {
        nextMap[key] = value;
      }

      setServiceActivityPreviewByAsset((prev) => (append ? { ...prev, ...nextMap } : nextMap));
    },
    [supabase],
  );

  const loadThumbnailsForAssets = useCallback(
    async (currentUserId: string, assetRows: ListAssetsRow[], options?: { append?: boolean }) => {
      const append = options?.append === true;
      if (assetRows.length === 0) {
        if (!append) setThumbnailUrls({});
        return;
      }

      const assetIds = assetRows.map((asset) => asset.id);
      const { data: mediaRows, error: mediaError } = await supabase
        .from("asset_media")
        .select("asset_id,type,storage_path")
        .eq("user_id", currentUserId)
        .eq("type", "image")
        .in("asset_id", assetIds);

      if (mediaError && !isMissingAssetMediaError(mediaError.message)) {
        setFeedback(mediaError.message);
      }

      const resolveSignedUrl = async (path: string, preferredBucket?: string) => {
        const candidateBuckets = preferredBucket
          ? [
              preferredBucket,
              ...THUMBNAIL_BUCKET_FALLBACK_ORDER.filter((bucket) => bucket !== preferredBucket),
            ]
          : [...THUMBNAIL_BUCKET_FALLBACK_ORDER];

        for (const bucket of candidateBuckets) {
          const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5);
          if (!signed.error && signed.data?.signedUrl) {
            return signed.data.signedUrl;
          }
        }

        return null;
      };

      const thumbnailSource = new Map<string, { path: string; preferredBucket?: string }>();
      for (const row of (mediaRows ?? []) as AssetMediaListRow[]) {
        if (!thumbnailSource.has(row.asset_id)) {
          thumbnailSource.set(row.asset_id, { path: row.storage_path, preferredBucket: ASSET_MEDIA_BUCKET });
        }
      }

      for (const asset of assetRows) {
        if (!thumbnailSource.has(asset.id) && asset.photo_path) {
          thumbnailSource.set(asset.id, { path: asset.photo_path });
        }
      }

      const signedEntries = await Promise.all(
        [...thumbnailSource.entries()].map(async ([assetId, source]) => {
          const signedUrl = await resolveSignedUrl(source.path, source.preferredBucket);
          if (!signedUrl) return null;
          return [assetId, signedUrl] as const;
        }),
      );

      const nextUrls: Record<string, string> = {};
      for (const entry of signedEntries) {
        if (!entry) continue;
        nextUrls[entry[0]] = entry[1];
      }

      setThumbnailUrls((prev) => (append ? { ...prev, ...nextUrls } : nextUrls));
    },
    [supabase],
  );

  const fetchAssetsPage = useCallback(
    async (
      currentUserId: string,
      options?: {
        append?: boolean;
        cursor?: AssetsCursor | null;
      } & AssetsListQueryOptions,
    ) => {
      const append = options?.append === true;

      if (append) {
        setIsLoadingMoreAssets(true);
      } else {
        setIsLoading(true);
      }

      try {
        const query = new URLSearchParams();
        query.set("pageSize", String(ASSETS_PAGE_SIZE));
        query.set("sort", options?.sort ?? "updated");
        if (options?.search) query.set("search", options.search);
        if (options?.category) query.set("category", options.category);
        if (options?.assetFilter) query.set("assetFilter", options.assetFilter);
        if (options?.warrantyFilter) query.set("warrantyFilter", options.warrantyFilter);
        if (options?.maintenanceFilter) query.set("maintenanceFilter", options.maintenanceFilter);
        if (options?.cursor?.value) query.set("cursorValue", options.cursor.value);
        if (options?.cursor?.id) query.set("cursorId", options.cursor.id);
        if (options?.cursor?.sort) query.set("cursorSort", options.cursor.sort);

        const response = await fetch(`/api/assets?${query.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => null)) as
          | (ListAssetsPageResponse & { error?: never })
          | { error?: string }
          | null;
        const errorMessage = response.ok ? null : (payload?.error ?? "Varliklar yuklenemedi.");

        if (errorMessage && isMissingQrCodeError(errorMessage)) {
          setFeedback("Veritabani surumu guncellemesi gerekiyor: qr_code kolonu eksik.");
          return;
        }

        if (errorMessage) {
          setFeedback(errorMessage);
          return;
        }

        const pageData = toListAssetsPageResponse(payload);
        const rows = (pageData.rows ?? []) as ListAssetsRow[];

        setHasMoreAssets(pageData.hasMore);
        setAssetsCursor(pageData.nextCursor);

        if (append) {
          setAssets((prev) => [...prev, ...rows]);
        } else {
          setAssets(rows);
        }

        await Promise.allSettled([
          fetchAssetActivityPreview(currentUserId, rows, { append }),
          loadThumbnailsForAssets(currentUserId, rows, { append }),
        ]);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Varliklar yuklenemedi.");
      } finally {
        if (append) {
          setIsLoadingMoreAssets(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [fetchAssetActivityPreview, loadThumbnailsForAssets],
  );

  useEffect(() => {
    if (!userId) return;

    void fetchAssetsPage(userId, {
      append: false,
      cursor: null,
      ...listQueryOptions,
    });
  }, [fetchAssetsPage, listQueryOptions, userId]);

  const dashboardRows = useMemo<AssetDashboardRow[]>(() => {
    return assets.map((asset) => {
      return {
        id: asset.id,
        name: asset.name,
        category: asset.category,
        serial_number: asset.serial_number,
        brand: asset.brand,
        model: asset.model,
        purchase_date: asset.purchase_date,
        warranty_end_date: asset.warranty_end_date,
        photo_path: asset.photo_path,
        qr_code: asset.qr_code,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        warrantyState: asset.warranty_state,
        maintenanceState: asset.maintenance_state,
        assetState: asset.asset_state,
        nextMaintenanceDate: asIsoDate(asset.next_maintenance_date),
        lastServiceDate: asIsoDate(asset.last_service_date),
        documentCount: Number(asset.document_count ?? 0),
        totalCost: Number(asset.total_cost ?? 0),
        score: Number(asset.score ?? 0),
      };
    });
  }, [assets]);

  const summary = useMemo(() => {
    const overdueCount = dashboardRows.filter((asset) => asset.maintenanceState === "overdue").length;
    const upcomingCount = dashboardRows.filter((asset) => asset.maintenanceState === "upcoming").length;
    const expiringWarrantyCount = dashboardRows.filter((asset) => asset.warrantyState !== "active").length;
    const avgScore =
      dashboardRows.length === 0
        ? 0
        : Math.round(dashboardRows.reduce((sum, asset) => sum + asset.score, 0) / dashboardRows.length);

    return { overdueCount, upcomingCount, expiringWarrantyCount, avgScore };
  }, [dashboardRows]);

  return {
    assets,
    setAssets,
    categories,
    totalAssetCount,
    assetsCursor,
    hasMoreAssets,
    isLoadingMoreAssets,
    thumbnailUrls,
    setThumbnailUrls,
    serviceActivityPreviewByAsset,
    setServiceActivityPreviewByAsset,
    isLoading,
    setIsLoading,
    feedback,
    setFeedback,
    refreshAssetCount,
    fetchCategoryOptions,
    fetchAssetsPage,
    dashboardRows,
    summary,
  };
}
