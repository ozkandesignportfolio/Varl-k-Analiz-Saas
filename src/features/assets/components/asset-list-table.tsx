import Link from "next/link";
import type { ReactNode } from "react";
import { AssetDeleteDialog } from "./asset-delete-dialog";

type AssetListTableRow = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  qr_code: string | null;
  photo_path: string | null;
  created_at: string;
};

type AssetListTableProps = {
  isLoading: boolean;
  assets: AssetListTableRow[];
  onStartEdit: (asset: AssetListTableRow) => void;
  onDeleteAsset: (asset: AssetListTableRow) => void;
  emptyState?: ReactNode;
};

export function AssetListTable({
  isLoading,
  assets,
  onStartEdit,
  onDeleteAsset,
  emptyState,
}: AssetListTableProps) {
  return (
    <section className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Varlik Listesi</h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
      ) : assets.length === 0 ? (
        emptyState ?? <p className="mt-4 text-sm text-slate-300">Henuz varlik eklenmedi.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                <th className="px-3 py-2">Ad</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Marka / Model</th>
                <th className="px-3 py-2">QR Kod</th>
                <th className="px-3 py-2">Fotograf</th>
                <th className="px-3 py-2">Islem</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-white/10 text-slate-100">
                  <td className="px-3 py-3 font-medium">{asset.name}</td>
                  <td className="px-3 py-3">{asset.category}</td>
                  <td className="px-3 py-3">
                    {[asset.brand, asset.model].filter(Boolean).join(" / ") || "-"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{asset.qr_code ?? "-"}</td>
                  <td className="px-3 py-3">{asset.photo_path ? "Yuklu" : "-"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                      >
                        Detay
                      </Link>
                      <button
                        type="button"
                        onClick={() => onStartEdit(asset)}
                        className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/20"
                      >
                        Duzenle
                      </button>
                      <AssetDeleteDialog
                        className="rounded-full border border-red-300/35 bg-red-300/10 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-300/20"
                        onConfirm={() => onDeleteAsset(asset)}
                      >
                        Sil
                      </AssetDeleteDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}