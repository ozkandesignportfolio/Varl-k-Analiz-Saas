import type { SetStateAction } from "react";
import type {
  AssetActivityItem,
  AssetDashboardRow,
} from "@/features/assets/components/assets-view-types";
import { ASSET_MEDIA_BUCKET } from "@/lib/assets/media-limits";
import type { AssetsCursor, ListAssetsRow } from "@/lib/repos/assets-repo";

export type ListAssetsPageResponse = {
  rows: ListAssetsRow[];
  nextCursor: AssetsCursor | null;
  hasMore: boolean;
};

export type AssetsDataState = {
  assets: ListAssetsRow[];
  categories: string[];
  totalAssetCount: number;
  assetsCursor: AssetsCursor | null;
  hasMoreAssets: boolean;
  isLoadingMoreAssets: boolean;
  thumbnailUrls: Record<string, string>;
  serviceActivityPreviewByAsset: Record<string, AssetActivityItem[]>;
  isLoading: boolean;
  assetsLoadError: string;
  feedback: string;
};

export const LEGACY_PHOTO_BUCKET = "documents-private";
export const THUMBNAIL_BUCKET_FALLBACK_ORDER = [ASSET_MEDIA_BUCKET, LEGACY_PHOTO_BUCKET] as const;
export const ASSETS_PAGE_SIZE = 30;

export const INITIAL_DATA_STATE: AssetsDataState = {
  assets: [],
  categories: [],
  totalAssetCount: 0,
  assetsCursor: null,
  hasMoreAssets: false,
  isLoadingMoreAssets: false,
  thumbnailUrls: {},
  serviceActivityPreviewByAsset: {},
  isLoading: true,
  assetsLoadError: "",
  feedback: "",
};

export const isMissingQrCodeError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("qr_code") &&
    (normalized.includes("does not exist") || normalized.includes("could not find the column"))
  );
};

export const isMissingAssetMediaError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("asset_media") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
};

export const isMissingAssetActivityPreviewError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  if (!normalized.includes("list_asset_activity_preview")) {
    return false;
  }

  return (
    normalized.includes("does not exist") ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find the function") ||
    normalized.includes("not found in schema cache") ||
    normalized.includes("undefined function")
  );
};

const asIsoDate = (value: string | null) => (value ? value.slice(0, 10) : null);

export const toListAssetsPageResponse = (payload: unknown): ListAssetsPageResponse => {
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

export const resolveSetStateAction = <T,>(next: SetStateAction<T>, current: T): T =>
  typeof next === "function" ? (next as (previousState: T) => T)(current) : next;

export const mapAssetsToDashboardRows = (assets: ListAssetsRow[]): AssetDashboardRow[] =>
  assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    serial_number: asset.serial_number,
    brand: asset.brand,
    model: asset.model,
    purchase_price: asset.purchase_price,
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
  }));

export const summarizeAssetDashboardRows = (dashboardRows: AssetDashboardRow[]) => {
  let overdueCount = 0;
  let upcomingCount = 0;
  let expiringWarrantyCount = 0;
  let totalScore = 0;

  for (const asset of dashboardRows) {
    if (asset.maintenanceState === "overdue") overdueCount += 1;
    if (asset.maintenanceState === "upcoming") upcomingCount += 1;
    if (asset.warrantyState !== "active") expiringWarrantyCount += 1;
    totalScore += asset.score;
  }

  const avgScore = dashboardRows.length === 0 ? 0 : Math.round(totalScore / dashboardRows.length);

  return { overdueCount, upcomingCount, expiringWarrantyCount, avgScore };
};
