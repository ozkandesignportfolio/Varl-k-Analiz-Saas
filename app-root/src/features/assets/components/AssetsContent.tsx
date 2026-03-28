import { memo } from "react";
import { AssetListTable } from "@/features/assets/components/asset-list-table";
import type { AssetDashboardRow, AssetViewMode } from "@/features/assets/components/assets-view-types";

type AssetsContentProps = {
  totalAssetCount: number;
  summary: {
    overdueCount: number;
    upcomingCount: number;
    expiringWarrantyCount: number;
    avgScore: number;
  };
  isLoading: boolean;
  assetsLoadError: string;
  viewMode: AssetViewMode;
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

export const AssetsContent = memo(function AssetsContent({
  totalAssetCount,
  summary,
  isLoading,
  assetsLoadError,
  viewMode,
  dashboardRows,
  hasActiveFilters,
  thumbnailUrls,
  onSelectAsset,
  onStartEdit,
  onShowQr,
  onDeleteAsset,
  onFocusCreateAsset,
  onClearFilters,
  hasMoreAssets,
  isLoadingMoreAssets,
  onLoadMore,
}: AssetsContentProps) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="assets-summary">
        <SummaryItem label="Toplam Varlık" value={String(totalAssetCount)} />
        <SummaryItem label="Yaklaşan Bakım" value={String(summary.upcomingCount)} />
        <SummaryItem label="Garanti Takibi" value={String(summary.expiringWarrantyCount)} />
        <SummaryItem label="Ortalama Skor" value={`${summary.avgScore}`} accent={summary.overdueCount > 0 ? "warn" : "ok"} />
      </section>

      <AssetListTable
        isLoading={isLoading}
        requestError={assetsLoadError}
        viewMode={viewMode}
        assets={dashboardRows}
        hasActiveFilters={hasActiveFilters}
        thumbnailUrls={thumbnailUrls}
        onSelectAsset={onSelectAsset}
        onStartEdit={onStartEdit}
        onShowQr={onShowQr}
        onDeleteAsset={onDeleteAsset}
        onFocusCreateAsset={onFocusCreateAsset}
        onClearFilters={onClearFilters}
      />

      {hasMoreAssets ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMoreAssets}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreAssets ? "Yükleniyor..." : "Daha Fazla Varlık"}
          </button>
        </div>
      ) : null}
    </>
  );
});

function SummaryItem({
  label,
  value,
  accent = "ok",
}: {
  label: string;
  value: string;
  accent?: "ok" | "warn";
}) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent === "warn" ? "text-amber-200" : "text-white"}`}>{value}</p>
    </article>
  );
}
