import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import { AssetDeleteDialog } from "@/features/assets/components/asset-delete-dialog";
import type { AssetDashboardRow, AssetViewMode, MaintenanceState, WarrantyState } from "./assets-view-types";

type AssetListTableProps = {
  isLoading: boolean;
  viewMode: AssetViewMode;
  assets: AssetDashboardRow[];
  thumbnailUrls: Record<string, string>;
  onSelectAsset: (asset: AssetDashboardRow) => void;
  onStartEdit: (asset: AssetDashboardRow) => void;
  onShowQr: (asset: AssetDashboardRow) => void;
  onDeleteAsset: (asset: AssetDashboardRow) => void;
  onFocusCreateAsset: () => void;
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

const actionButtonClass =
  "rounded-full border px-3 py-1 text-xs font-semibold transition";

export function AssetListTable({
  isLoading,
  viewMode,
  assets,
  thumbnailUrls,
  onSelectAsset,
  onStartEdit,
  onShowQr,
  onDeleteAsset,
  onFocusCreateAsset,
}: AssetListTableProps) {
  return (
    <section className="premium-card p-5" data-testid="assets-list-section">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Varlık Listesi</h2>
        <p className="text-xs text-slate-400">{assets.length} kayıt</p>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : assets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/25 bg-white/[0.03] p-8 text-center">
          <p className="text-lg font-semibold text-white">Henüz varlık eklenmedi</p>
          <p className="mt-1 text-sm text-slate-300">İlk varlığınızı ekleyerek envanterinizi başlatın.</p>
          <button
            type="button"
            onClick={onFocusCreateAsset}
            className="mt-4 rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Varlık Ekle
          </button>
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
                <tr
                  key={asset.id}
                  className="cursor-pointer border-b border-white/10 text-slate-100 transition hover:bg-white/[0.03]"
                  onClick={() => onSelectAsset(asset)}
                  data-testid={`asset-row-${asset.id}`}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {thumbnailUrls[asset.id] ? (
                        <div className="h-12 w-16 overflow-hidden rounded-lg border border-white/12">
                          <Image
                            src={thumbnailUrls[asset.id]}
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
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${warrantyBadgeClass[asset.warrantyState]}`}>
                      {warrantyText[asset.warrantyState]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm text-slate-100">{formatDate(asset.nextMaintenanceDate)}</p>
                    <p className={`text-xs ${maintenanceClass[asset.maintenanceState]}`}>
                      {maintenanceText[asset.maintenanceState]}
                    </p>
                  </td>
                  <td className="px-3 py-3">{formatDate(asset.lastServiceDate)}</td>
                  <td className="px-3 py-3">{asset.documentCount}</td>
                  <td className="px-3 py-3">{formatCurrency(asset.totalCost)}</td>
                  <td className="px-3 py-3">
                    <ActionButtons
                      asset={asset}
                      onStartEdit={onStartEdit}
                      onShowQr={onShowQr}
                      onDeleteAsset={onDeleteAsset}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <article
              key={asset.id}
              onClick={() => onSelectAsset(asset)}
              className="cursor-pointer rounded-xl border border-white/12 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-white">{asset.name}</h3>
                  <p className="text-xs text-slate-300">{asset.category}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${warrantyBadgeClass[asset.warrantyState]}`}>
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
    </section>
  );
}

type ActionButtonsProps = {
  asset: AssetDashboardRow;
  onStartEdit: (asset: AssetDashboardRow) => void;
  onShowQr: (asset: AssetDashboardRow) => void;
  onDeleteAsset: (asset: AssetDashboardRow) => void;
};

function ActionButtons({ asset, onStartEdit, onShowQr, onDeleteAsset }: ActionButtonsProps) {
  const stopPropagation = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

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
        onClick={() => onStartEdit(asset)}
        className={`${actionButtonClass} border-sky-300/35 bg-sky-300/10 text-sky-100 hover:bg-sky-300/20`}
      >
        Düzenle
      </button>
      <button
        type="button"
        onClick={() => onShowQr(asset)}
        className={`${actionButtonClass} border-violet-300/35 bg-violet-300/10 text-violet-100 hover:bg-violet-300/20`}
      >
        QR
      </button>
      <AssetDeleteDialog
        className={`${actionButtonClass} border-red-300/35 bg-red-300/10 text-red-100 hover:bg-red-300/20`}
        onConfirm={() => onDeleteAsset(asset)}
      >
        Sil
      </AssetDeleteDialog>
    </div>
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
