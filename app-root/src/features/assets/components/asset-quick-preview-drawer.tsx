import Link from "next/link";
import { X } from "lucide-react";
import type { AssetActivityItem, AssetDashboardRow } from "@/features/assets/components/assets-view-types";

type AssetQuickPreviewDrawerProps = {
  asset: AssetDashboardRow | null;
  activities: AssetActivityItem[];
  onClose: () => void;
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

const maintenanceLabel: Record<AssetDashboardRow["maintenanceState"], string> = {
  none: "Yok",
  scheduled: "Planlı",
  upcoming: "Yaklaşan",
  overdue: "Gecikmiş",
};

const warrantyLabel: Record<AssetDashboardRow["warrantyState"], string> = {
  active: "Aktif",
  expiring: "Bitiyor",
  expired: "Bitti",
};

export function AssetQuickPreviewDrawer({ asset, activities, onClose }: AssetQuickPreviewDrawerProps) {
  if (!asset) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-label="Önizlemeyi kapat"
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-white/15 bg-slate-950/95 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Hızlı Önizleme</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{asset.name}</h2>
            <p className="mt-1 text-sm text-slate-300">{asset.category}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <article className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Temel Bilgiler</p>
            <dl className="mt-2 space-y-2 text-sm text-slate-200">
              <Row label="Seri No" value={asset.serial_number ?? "Yok"} />
              <Row label="Marka / Model" value={[asset.brand, asset.model].filter(Boolean).join(" / ") || "Yok"} />
              <Row label="Son güncelleme" value={formatDate(asset.updated_at)} />
            </dl>
          </article>

          <article className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Garanti ve Bakım</p>
            <dl className="mt-2 space-y-2 text-sm text-slate-200">
              <Row label="Garanti" value={warrantyLabel[asset.warrantyState]} />
              <Row label="Bakım" value={maintenanceLabel[asset.maintenanceState]} />
              <Row label="Yaklaşan bakım" value={formatDate(asset.nextMaintenanceDate)} />
              <Row label="Son servis" value={formatDate(asset.lastServiceDate)} />
            </dl>
          </article>

          <article className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Son İşlemler</p>
            {activities.length === 0 ? (
              <p className="mt-2 text-sm text-slate-300">Bu varlık için yakın tarihte servis kaydı bulunmuyor.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {activities.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-slate-950/50 p-2">
                    <p className="text-sm font-medium text-slate-100">{item.serviceType}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDate(item.serviceDate)}</p>
                    <p className="mt-1 text-xs text-emerald-300">{formatCurrency(item.cost)}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <Link
          href={`/assets/${asset.id}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-sky-300/35 bg-sky-300/15 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/25"
        >
          Detaya Git
        </Link>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-100">{value}</dd>
    </div>
  );
}
