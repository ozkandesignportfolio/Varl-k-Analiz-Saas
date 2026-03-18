"use client";

import { QrScannerModal } from "@/components/qr-scanner-modal";
import { QuotaExceededModal } from "@/components/ui/QuotaExceededModal";
import { AssetQrPreviewModal } from "@/features/assets/components/asset-qr-preview-modal";
import { AssetQuickPreviewDrawer } from "@/features/assets/components/asset-quick-preview-drawer";
import { AssetsContent } from "@/features/assets/components/AssetsContent";
import { AssetsFilterBar } from "@/features/assets/components/assets-filter-bar";
import type {
  AssetActivityItem,
  AssetDashboardRow,
  AssetFilterMode,
  AssetSortMode,
  AssetViewMode,
  MaintenanceFilterMode,
  WarrantyFilterMode,
} from "@/features/assets/components/assets-view-types";

type AssetsHeaderActionsProps = {
  onCreateAsset: () => void;
  onOpenScanner: () => void;
};

type AssetsDialogsSectionProps = {
  isScannerOpen: boolean;
  onCloseScanner: () => void;
  onDetectedQrValue: (value: string) => void;
  qrPreviewAsset: AssetDashboardRow | null;
  onCloseQrPreview: () => void;
  selectedPreviewAsset: AssetDashboardRow | null;
  selectedPreviewActivities: AssetActivityItem[];
  onCloseAssetPreview: () => void;
  isQuotaModalOpen: boolean;
  onQuotaModalOpenChange: (open: boolean) => void;
  assetLimit: number;
  quotaModalAssets: Array<{ id: string; name: string; category: string }>;
};

type AssetsListingSectionProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  assetFilter: AssetFilterMode;
  onAssetFilterChange: (value: AssetFilterMode) => void;
  warrantyFilter: WarrantyFilterMode;
  onWarrantyFilterChange: (value: WarrantyFilterMode) => void;
  maintenanceFilter: MaintenanceFilterMode;
  onMaintenanceFilterChange: (value: MaintenanceFilterMode) => void;
  sortMode: AssetSortMode;
  onSortModeChange: (value: AssetSortMode) => void;
  viewMode: AssetViewMode;
  onViewModeChange: (value: AssetViewMode) => void;
  categories: string[];
  totalAssetCount: number;
  summary: {
    overdueCount: number;
    upcomingCount: number;
    expiringWarrantyCount: number;
    avgScore: number;
  };
  isLoading: boolean;
  assetsLoadError: string;
  dashboardRows: AssetDashboardRow[];
  hasActiveFilters: boolean;
  thumbnailUrls: Record<string, string>;
  onSelectAsset: (asset: AssetDashboardRow) => void;
  onStartEdit: (asset: AssetDashboardRow) => void;
  onShowQr: (asset: AssetDashboardRow) => void;
  onDeleteAsset: (asset: AssetDashboardRow) => void;
  onFocusCreateAsset: () => void;
  onClearFilters: () => void;
  hasMoreAssets: boolean;
  isLoadingMoreAssets: boolean;
  onLoadMore: () => void;
};

export function AssetsHeaderActions({ onCreateAsset, onOpenScanner }: AssetsHeaderActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onCreateAsset}
        className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
      >
        Yeni Varlık
      </button>
      <button
        type="button"
        onClick={onOpenScanner}
        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
      >
        QR Tara
      </button>
    </div>
  );
}

export function AssetsDialogsSection({
  isScannerOpen,
  onCloseScanner,
  onDetectedQrValue,
  qrPreviewAsset,
  onCloseQrPreview,
  selectedPreviewAsset,
  selectedPreviewActivities,
  onCloseAssetPreview,
  isQuotaModalOpen,
  onQuotaModalOpenChange,
  assetLimit,
  quotaModalAssets,
}: AssetsDialogsSectionProps) {
  return (
    <>
      <QrScannerModal isOpen={isScannerOpen} onClose={onCloseScanner} onDetected={onDetectedQrValue} />
      <AssetQrPreviewModal asset={qrPreviewAsset} isOpen={Boolean(qrPreviewAsset)} onClose={onCloseQrPreview} />
      <AssetQuickPreviewDrawer
        asset={selectedPreviewAsset}
        activities={selectedPreviewActivities}
        onClose={onCloseAssetPreview}
      />
      <QuotaExceededModal
        open={isQuotaModalOpen}
        onOpenChange={onQuotaModalOpenChange}
        assets={quotaModalAssets}
        assetLimit={assetLimit}
      />
    </>
  );
}

export function AssetsListingSection(props: AssetsListingSectionProps) {
  return (
    <div className="space-y-6">
      <AssetsFilterBar
        searchTerm={props.searchTerm}
        onSearchTermChange={props.onSearchTermChange}
        categoryFilter={props.categoryFilter}
        onCategoryFilterChange={props.onCategoryFilterChange}
        assetFilter={props.assetFilter}
        onAssetFilterChange={props.onAssetFilterChange}
        warrantyFilter={props.warrantyFilter}
        onWarrantyFilterChange={props.onWarrantyFilterChange}
        maintenanceFilter={props.maintenanceFilter}
        onMaintenanceFilterChange={props.onMaintenanceFilterChange}
        sortMode={props.sortMode}
        onSortModeChange={props.onSortModeChange}
        viewMode={props.viewMode}
        onViewModeChange={props.onViewModeChange}
        categories={props.categories}
      />

      <AssetsContent
        totalAssetCount={props.totalAssetCount}
        summary={props.summary}
        isLoading={props.isLoading}
        assetsLoadError={props.assetsLoadError}
        viewMode={props.viewMode}
        dashboardRows={props.dashboardRows}
        hasActiveFilters={props.hasActiveFilters}
        thumbnailUrls={props.thumbnailUrls}
        onSelectAsset={props.onSelectAsset}
        onStartEdit={props.onStartEdit}
        onShowQr={props.onShowQr}
        onDeleteAsset={props.onDeleteAsset}
        onFocusCreateAsset={props.onFocusCreateAsset}
        onClearFilters={props.onClearFilters}
        hasMoreAssets={props.hasMoreAssets}
        isLoadingMoreAssets={props.isLoadingMoreAssets}
        onLoadMore={props.onLoadMore}
      />
    </div>
  );
}
