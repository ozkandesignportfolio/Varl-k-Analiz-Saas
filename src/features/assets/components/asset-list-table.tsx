import Image from "next/image";
import Link from "next/link";
import { memo, type MouseEvent, useCallback } from "react";
import { AssetDeleteDialog } from "@/features/assets/components/asset-delete-dialog";
import type { AssetDashboardRow, AssetViewMode, MaintenanceState, WarrantyState } from "./assets-view-types";

type AssetListTableProps = {
  isLoading: boolean;
  viewMode: AssetViewMode;
  assets: AssetDashboardRow[];
  requestError?: string;
  hasActiveFilters: boolean;
  thumbnailUrls: Record<string, string>;
  onSelectAsset: (asset: AssetDashboardRow) => void;
  onStartEdit: (asset: AssetDashboardRow) => void;
  onShowQr: (asset: AssetDashboardRow) => void;
  onDeleteAsset: (asset: AssetDashboardRow) => void;
  onFocusCreateAsset: () => void;
  onClearFilters: () => void;
};

const formatDate = (value: string | null) => {
  if (!value) return "Yok";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Yok";
  return parsed.toLocaleDateString("tr-TR");
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  });

const warrantyBadgeClass: Record<WarrantyState, string> = {
  active: "border-emerald-300/35 bg-emerald-300/15 text-emerald-100",
  expiring: "border-amber-300/40 bg-amber-300/15 text-amber-100",
  expired: "border-rose-300/35 bg-rose-300/15 text-rose-100",
};

const warrantyText: Record<WarrantyState, string> = {
  active: "Aktif",
  expiring: "Bitiyor",
  expired: "Bitti",
};

const maintenanceText: Record<MaintenanceState, string> = {
  none: "Yok",
  scheduled: "Planlı",
  upcoming: "Yaklaşan",
  overdue: "Gecikmiş",
};

const maintenanceClass: Record<MaintenanceState, string> = {
  none: "text-slate-300",
  scheduled: "text-sky-200",
  upcoming: "text-amber-200",
  overdue: "text-rose-200",
};

const actionButtonClass = "rounded-full border px-3 py-1 text-xs font-semibold transition";

const isSameAsset = (left: AssetDashboardRow, right: AssetDashboardRow) =>
  left.id === right.id &&
  left.name === right.name &&
  left.category === right.category &&
  left.serial_number === right.serial_number &&
  left.brand === right.brand &&
  left.model === right.model &&
  left.purchase_price === right.purchase_price &&
  left.purchase_date === right.purchase_date &&
  left.warranty_end_date === right.warranty_end_date &&
  left.photo_path === right.photo_path &&
  left.qr_code === right.qr_code &&
  left.created_at === right.created_at &&
  left.updated_at === right.updated_at &&
  left.warrantyState === right.warrantyState &&
  left.maintenanceState === right.maintenanceState &&
  left.assetState === right.assetState &&
  left.nextMaintenanceDate === right.nextMaintenanceDate &&
  left.lastServiceDate === right.lastServiceDate &&
  left.documentCount === right.documentCount &&
  left.totalCost === right.totalCost &&
  left.score === right.score;

type AssetRowProps = {
  asset: AssetDashboardRow;
  thumbnailUrl?: string;
  onSelectAsset: (asset: AssetDashboardRow) => void;
  onStartEdit: (asset: AssetDashboardRow) => void;
  onShowQr: (asset: AssetDashboardRow) => void;
  onDeleteAsset: (asset: AssetDashboardRow) => void;
};

const AssetRow = memo(function AssetRow({
  asset,
  thumbnailUrl,
  onSelectAsset,
  onStartEdit,
  onShowQr,
  onDeleteAsset,
}: AssetRowProps) {
  const handleSelect = useCallback(() => {
    onSelectAsset(asset);
  }, [asset, onSelectAsset]);

  return (
    <tr
      className="cursor-pointer border-b border-white/10 text-slate-100 transition hover:bg-white/[0.03]"
      onClick={handleSelect}
      data-testid="asset-row"
      data-asset-id={asset.id}
    >
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {thumbnailUrl ? (
            <div className="h-12 w-16 overflow-hidden rounded-lg border border-white/12">
              <Image
                src={thumbnailUrl}
                alt={`${asset.name} thumbnail`}
                width={160}
                height={120}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-12 w-16 items-center justify-center rounded-lg border border-white/12 bg-white/[0.03] text-[11px] text-slate-400">
              Yok
            </div>
          )}
          <div>
            <p className="font-medium text-white">{asset.name}</p>
            <p className="text-xs text-slate-300">{asset.category}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${warrantyBadgeClass[asset.warrantyState]}`}
        >
          {warrantyText[asset.warrantyState]}
        </span>
      </td>
      <td className="px-3 py-3">
        <p className="text-sm text-slate-100">{formatDate(asset.nextMaintenanceDate)}</p>
        <p className={`text-xs ${maintenanceClass[asset.maintenanceState]}`}>{maintenanceText[asset.maintenanceState]}</p>
      </td>
      <td className="px-3 py-3">{formatDate(asset.lastServiceDate)}</td>
      <td className="px-3 py-3">{asset.documentCount}</td>
      <td className="px-3 py-3">{formatCurrency(asset.totalCost)}</td>
      <td className="px-3 py-3">
        <ActionButtons asset={asset} onStartEdit={onStartEdit} onShowQr={onShowQr} onDeleteAsset={onDeleteAsset} />
      </td>
    </tr>
  );
}, areAssetRowPropsEqual);

function areAssetRowPropsEqual(previous: AssetRowProps, next: AssetRowProps) {
  return (
    previous.thumbnailUrl === next.thumbnailUrl &&
    previous.onSelectAsset === next.onSelectAsset &&
    previous.onStartEdit === next.onStartEdit &&
    previous.onShowQr === next.onShowQr &&
    previous.onDeleteAsset === next.onDeleteAsset &&
    isSameAsset(previous.asset, next.asset)
  );
}

export const AssetListTable = memo(function AssetListTable({
  isLoading,
  viewMode,
  assets,
  requestError,
  hasActiveFilters,
  thumbnailUrls,
  onSelectAsset,
  onStartEdit,
  onShowQr,
  onDeleteAsset,
  onFocusCreateAsset,
  onClearFilters,
}: AssetListTableProps) {
  return (
    <section className="premium-card p-5" data-testid="assets-list-section">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Varlık Listesi</h2>
        <p className="text-xs text-slate-400">
          {requestError && assets.length === 0 ? "Liste hatası" : `${assets.length} kayıt`}
        </p>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : requestError && assets.length === 0 ? (
        <div
          className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-8 text-center"
          data-testid="assets-list-error-state"
        >
          <p className="text-lg font-semibold text-white">Varlık listesi yüklenemedi</p>
          <p className="mt-1 text-sm text-slate-200">{requestError}</p>
          <p className="mt-3 text-xs text-slate-300">
            Bu durum gerçek boş liste anlamına gelmez. Lütfen tekrar deneyin.
          </p>
        </div>
      ) : assets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/25 bg-white/[0.03] p-8 text-center">
          {hasActiveFilters ? (
            <>
              <p className="text-lg font-semibold text-white">Filtrelere uygun kayıt bulunamadı</p>
              <p className="mt-1 text-sm text-slate-300">Arama veya filtreleri temizleyip tekrar deneyin.</p>
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-4 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
              >
                Filtreleri Temizle
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-white">Henüz varlık eklenmedi</p>
              <p className="mt-1 text-sm text-slate-300">İlk varlığınızı ekleyerek envanterinizi başlatın.</p>
              <button
                type="button"
                onClick={onFocusCreateAsset}
                className="mt-4 rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Varlık Ekle
              </button>
            </>
          )}
        </div>
      ) : viewMode === "table" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm" data-testid="assets-table">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                <th className="px-3 py-2">Varlık</th>
                <th className="px-3 py-2">Garanti Durumu</th>
                <th className="px-3 py-2">Yaklaşan Bakım</th>
                <th className="px-3 py-2">Son Servis</th>
                <th className="px-3 py-2">Belge Sayısı</th>
                <th className="px-3 py-2">Toplam Maliyet</th>
                <th className="px-3 py-2">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  thumbnailUrl={thumbnailUrls[asset.id]}
                  onSelectAsset={onSelectAsset}
                  onStartEdit={onStartEdit}
                  onShowQr={onShowQr}
                  onDeleteAsset={onDeleteAsset}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <article
              key={asset.id}
              data-testid="asset-row"
              data-asset-id={asset.id}
              onClick={() => onSelectAsset(asset)}
              className="cursor-pointer rounded-xl border border-white/12 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-white">{asset.name}</h3>
                  <p className="text-xs text-slate-300">{asset.category}</p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${warrantyBadgeClass[asset.warrantyState]}`}
                >
                  {warrantyText[asset.warrantyState]}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-sm text-slate-200">
                <Row label="Yaklaşan bakım" value={formatDate(asset.nextMaintenanceDate)} />
                <Row label="Son servis" value={formatDate(asset.lastServiceDate)} />
                <Row label="Belge sayısı" value={String(asset.documentCount)} />
                <Row label="Toplam maliyet" value={formatCurrency(asset.totalCost)} />
              </dl>

              <div className="mt-3">
                <ActionButtons
                  asset={asset}
                  onStartEdit={onStartEdit}
                  onShowQr={onShowQr}
                  onDeleteAsset={onDeleteAsset}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      {requestError && assets.length > 0 ? (
        <p
          className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-50"
          data-testid="assets-list-warning"
        >
          {requestError}
        </p>
      ) : null}
    </section>
  );
});

type ActionButtonsProps = {
  asset: AssetDashboardRow;
  onStartEdit: (asset: AssetDashboardRow) => void;
  onShowQr: (asset: AssetDashboardRow) => void;
  onDeleteAsset: (asset: AssetDashboardRow) => void;
};

const ActionButtons = memo(function ActionButtons({ asset, onStartEdit, onShowQr, onDeleteAsset }: ActionButtonsProps) {
  const stopPropagation = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const handleStartEdit = useCallback(() => {
    onStartEdit(asset);
  }, [asset, onStartEdit]);

  const handleShowQr = useCallback(() => {
    onShowQr(asset);
  }, [asset, onShowQr]);

  const handleDelete = useCallback(() => {
    onDeleteAsset(asset);
  }, [asset, onDeleteAsset]);

  return (
    <div className="flex flex-wrap gap-2" onClick={stopPropagation}>
      <Link
        href={`/assets/${asset.id}`}
        className={`${actionButtonClass} border-emerald-300/35 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20`}
      >
        Detay
      </Link>
      <button
        type="button"
        onClick={handleStartEdit}
        className={`${actionButtonClass} border-sky-300/35 bg-sky-300/10 text-sky-100 hover:bg-sky-300/20`}
      >
        Düzenle
      </button>
      <button
        type="button"
        onClick={handleShowQr}
        className={`${actionButtonClass} border-violet-300/35 bg-violet-300/10 text-violet-100 hover:bg-violet-300/20`}
      >
        QR
      </button>
      <AssetDeleteDialog
        className={`${actionButtonClass} border-red-300/35 bg-red-300/10 text-red-100 hover:bg-red-300/20`}
        onConfirm={handleDelete}
      >
        Sil
      </AssetDeleteDialog>
    </div>
  );
}, areActionButtonsPropsEqual);

function areActionButtonsPropsEqual(previous: ActionButtonsProps, next: ActionButtonsProps) {
  return (
    previous.onStartEdit === next.onStartEdit &&
    previous.onShowQr === next.onShowQr &&
    previous.onDeleteAsset === next.onDeleteAsset &&
    isSameAsset(previous.asset, next.asset)
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-100">{value}</dd>
    </div>
  );
}
