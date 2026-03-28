import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetActivityItem } from "@/features/assets/components/assets-view-types";
import {
  ASSETS_PAGE_SIZE,
  INITIAL_DATA_STATE,
  THUMBNAIL_BUCKET_FALLBACK_ORDER,
  isMissingAssetActivityPreviewError,
  isMissingAssetMediaError,
  isMissingQrCodeError,
  mapAssetsToDashboardRows,
  resolveSetStateAction,
  summarizeAssetDashboardRows,
  toListAssetsPageResponse,
  type AssetsDataState,
  type ListAssetsPageResponse,
} from "@/features/assets/lib/assets-data-utils";
import { ASSET_MEDIA_BUCKET } from "@/lib/assets/media-limits";
import {
  type AssetsCursor,
  countByUser as countAssetsByUser,
  listCategories as listAssetCategories,
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

export function useAssetsData({ supabase, setAssetCount, userId, listQueryOptions }: UseAssetsDataArgs) {
  const [state, setState] = useState<AssetsDataState>(INITIAL_DATA_STATE);
  const activeQueryVersionRef = useRef(0);
  const replaceRequestAbortRef = useRef<AbortController | null>(null);
  const thumbnailUrlCacheRef = useRef(new Map<string, string | null>());
  const serviceActivityPreviewCacheRef = useRef(new Map<string, AssetActivityItem[]>());

  const isActiveQueryVersion = useCallback(
    (queryVersion: number) => activeQueryVersionRef.current === queryVersion,
    [],
  );

  const setAssets = useCallback((next: SetStateAction<ListAssetsRow[]>) => {
    setState((prev) => ({ ...prev, assets: resolveSetStateAction(next, prev.assets) }));
  }, []);

  const setThumbnailUrls = useCallback((next: SetStateAction<Record<string, string>>) => {
    setState((prev) => {
      const resolved = resolveSetStateAction(next, prev.thumbnailUrls);
      for (const [assetId, url] of Object.entries(resolved)) {
        thumbnailUrlCacheRef.current.set(assetId, url);
      }
      return { ...prev, thumbnailUrls: resolved };
    });
  }, []);

  const setServiceActivityPreviewByAsset = useCallback(
    (next: SetStateAction<Record<string, AssetActivityItem[]>>) => {
      setState((prev) => {
        const resolved = resolveSetStateAction(next, prev.serviceActivityPreviewByAsset);
        for (const [assetId, items] of Object.entries(resolved)) {
          serviceActivityPreviewCacheRef.current.set(assetId, items);
        }
        return {
          ...prev,
          serviceActivityPreviewByAsset: resolved,
        };
      });
    },
    [],
  );

  const setIsLoading = useCallback((next: SetStateAction<boolean>) => {
    setState((prev) => ({ ...prev, isLoading: resolveSetStateAction(next, prev.isLoading) }));
  }, []);

  const setFeedback = useCallback((next: SetStateAction<string>) => {
    setState((prev) => ({ ...prev, feedback: resolveSetStateAction(next, prev.feedback) }));
  }, []);

  const setAssetsLoadError = useCallback((next: SetStateAction<string>) => {
    setState((prev) => ({ ...prev, assetsLoadError: resolveSetStateAction(next, prev.assetsLoadError) }));
  }, []);

  const refreshAssetCount = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await countAssetsByUser(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      const count = data ?? 0;
      setState((prev) => ({ ...prev, totalAssetCount: count }));
      setAssetCount(count);
    },
    [setAssetCount, setFeedback, supabase],
  );

  const fetchCategoryOptions = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listAssetCategories(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      setState((prev) => ({ ...prev, categories: data ?? [] }));
    },
    [setFeedback, supabase],
  );

  const fetchAssetActivityPreview = useCallback(
    async (
      currentUserId: string,
      assetRows: ListAssetsRow[],
      options?: { append?: boolean; queryVersion?: number },
    ) => {
      const append = options?.append === true;
      if (assetRows.length === 0) {
        if (!append && isActiveQueryVersion(options?.queryVersion ?? activeQueryVersionRef.current)) {
          setServiceActivityPreviewByAsset({});
        }
        return;
      }

      const assetIds = assetRows.map((asset) => asset.id);
      const cachedEntries: Record<string, AssetActivityItem[]> = {};
      const missingAssetIds: string[] = [];

      for (const assetId of assetIds) {
        const cached = serviceActivityPreviewCacheRef.current.get(assetId);
        if (cached) {
          cachedEntries[assetId] = cached;
          continue;
        }

        missingAssetIds.push(assetId);
      }

      if (missingAssetIds.length === 0) {
        setServiceActivityPreviewByAsset((prev) => (append ? { ...prev, ...cachedEntries } : cachedEntries));
        return;
      }

      const { data, error } = await listAssetActivityPreview(supabase, {
        userId: currentUserId,
        assetIds: missingAssetIds,
        perAssetLimit: 3,
      });

      if (!isActiveQueryVersion(options?.queryVersion ?? activeQueryVersionRef.current)) {
        return;
      }

      if (error) {
        if (isMissingAssetActivityPreviewError(error.message)) {
          if (!append) setServiceActivityPreviewByAsset({});
          return;
        }
        setFeedback(error.message);
        return;
      }

      const grouped = new Map<string, AssetActivityItem[]>();
      for (const assetId of missingAssetIds) {
        grouped.set(assetId, []);
      }
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
        serviceActivityPreviewCacheRef.current.set(key, value);
        nextMap[key] = value;
      }

      const resolvedEntries = { ...cachedEntries, ...nextMap };
      setServiceActivityPreviewByAsset((prev) => (append ? { ...prev, ...resolvedEntries } : resolvedEntries));
    },
    [isActiveQueryVersion, setFeedback, setServiceActivityPreviewByAsset, supabase],
  );

  const loadThumbnailsForAssets = useCallback(
    async (
      currentUserId: string,
      assetRows: ListAssetsRow[],
      options?: { append?: boolean; queryVersion?: number },
    ) => {
      const append = options?.append === true;
      if (assetRows.length === 0) {
        if (!append && isActiveQueryVersion(options?.queryVersion ?? activeQueryVersionRef.current)) {
          setThumbnailUrls({});
        }
        return;
      }

      const cachedEntries: Record<string, string> = {};
      const uncachedRows: ListAssetsRow[] = [];
      for (const asset of assetRows) {
        const cached = thumbnailUrlCacheRef.current.get(asset.id);
        if (typeof cached === "string" && cached.length > 0) {
          cachedEntries[asset.id] = cached;
          continue;
        }
        if (cached === null) {
          continue;
        }

        uncachedRows.push(asset);
      }

      if (uncachedRows.length === 0) {
        setThumbnailUrls((prev) => (append ? { ...prev, ...cachedEntries } : cachedEntries));
        return;
      }

      const assetIds = uncachedRows.map((asset) => asset.id);
      const { data: mediaRows, error: mediaError } = await supabase
        .from("asset_media")
        .select("asset_id,type,storage_path")
        .eq("user_id", currentUserId)
        .eq("type", "image")
        .in("asset_id", assetIds);

      if (!isActiveQueryVersion(options?.queryVersion ?? activeQueryVersionRef.current)) {
        return;
      }

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

      for (const asset of uncachedRows) {
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
      for (const asset of uncachedRows) {
        thumbnailUrlCacheRef.current.set(asset.id, null);
      }
      for (const entry of signedEntries) {
        if (!entry) continue;
        thumbnailUrlCacheRef.current.set(entry[0], entry[1]);
        nextUrls[entry[0]] = entry[1];
      }

      if (!isActiveQueryVersion(options?.queryVersion ?? activeQueryVersionRef.current)) {
        return;
      }

      const resolvedEntries = { ...cachedEntries, ...nextUrls };
      setThumbnailUrls((prev) => (append ? { ...prev, ...resolvedEntries } : resolvedEntries));
    },
    [isActiveQueryVersion, setFeedback, setThumbnailUrls, supabase],
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
      const queryVersion = append ? activeQueryVersionRef.current : activeQueryVersionRef.current + 1;
      let requestAbortController: AbortController | null = null;

      if (append) {
        if (queryVersion === 0) {
          return;
        }
      } else {
        activeQueryVersionRef.current = queryVersion;
        replaceRequestAbortRef.current?.abort();
        requestAbortController = new AbortController();
        replaceRequestAbortRef.current = requestAbortController;
      }

      if (append) {
        setState((prev) => ({ ...prev, isLoadingMoreAssets: true }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          isLoadingMoreAssets: false,
          assetsLoadError: "",
        }));
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
          signal: requestAbortController?.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | (ListAssetsPageResponse & { error?: never })
          | { error?: string }
          | null;
        const errorMessage = response.ok ? null : (payload?.error ?? "Varlıklar yüklenemedi.");

        if (!isActiveQueryVersion(queryVersion)) {
          return;
        }

        if (errorMessage && isMissingQrCodeError(errorMessage)) {
          setAssetsLoadError("Veritabanı sürümü güncellemesi gerekiyor: `qr_code` kolonu eksik.");
          return;
        }

        if (errorMessage) {
          setAssetsLoadError(errorMessage);
          return;
        }

        const pageData = toListAssetsPageResponse(payload);
        const rows = (pageData.rows ?? []) as ListAssetsRow[];

        setState((prev) => ({
          ...prev,
          assetsLoadError: "",
          hasMoreAssets: pageData.hasMore,
          assetsCursor: pageData.nextCursor,
          assets: append ? [...prev.assets, ...rows] : rows,
        }));

        void Promise.allSettled([
          fetchAssetActivityPreview(currentUserId, rows, { append, queryVersion }),
          loadThumbnailsForAssets(currentUserId, rows, { append, queryVersion }),
        ]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!isActiveQueryVersion(queryVersion)) {
          return;
        }
        setAssetsLoadError("Varlıklar yüklenemedi.");
      } finally {
        if (!append && replaceRequestAbortRef.current === requestAbortController) {
          replaceRequestAbortRef.current = null;
        }
        if (!isActiveQueryVersion(queryVersion)) {
          return;
        }
        if (append) {
          setState((prev) => ({ ...prev, isLoadingMoreAssets: false }));
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    },
    [fetchAssetActivityPreview, isActiveQueryVersion, loadThumbnailsForAssets, setAssetsLoadError],
  );

  useEffect(() => {
    if (!userId) return;

    void fetchAssetsPage(userId, {
      append: false,
      cursor: null,
      ...listQueryOptions,
    });
  }, [fetchAssetsPage, listQueryOptions, userId]);

  useEffect(
    () => () => {
      replaceRequestAbortRef.current?.abort();
    },
    [],
  );

  const dashboardRows = useMemo(() => mapAssetsToDashboardRows(state.assets), [state.assets]);

  const summary = useMemo(() => summarizeAssetDashboardRows(dashboardRows), [dashboardRows]);

  return {
    assets: state.assets,
    setAssets,
    categories: state.categories,
    totalAssetCount: state.totalAssetCount,
    assetsCursor: state.assetsCursor,
    hasMoreAssets: state.hasMoreAssets,
    isLoadingMoreAssets: state.isLoadingMoreAssets,
    thumbnailUrls: state.thumbnailUrls,
    setThumbnailUrls,
    serviceActivityPreviewByAsset: state.serviceActivityPreviewByAsset,
    setServiceActivityPreviewByAsset,
    isLoading: state.isLoading,
    setIsLoading,
    assetsLoadError: state.assetsLoadError,
    feedback: state.feedback,
    setFeedback,
    refreshAssetCount,
    fetchCategoryOptions,
    fetchAssetsPage,
    dashboardRows,
    summary,
  };
}
