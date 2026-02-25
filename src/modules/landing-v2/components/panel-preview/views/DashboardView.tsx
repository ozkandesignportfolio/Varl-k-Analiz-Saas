import { memo } from "react";
import { AlertTriangle, FileText, Package, Plus, TrendingUp, Wrench } from "lucide-react";
import type { PanelPreviewViewProps } from "@/modules/landing-v2/components/panel-preview/types";
import { cn } from "@/lib/utils";

const DASHBOARD_FILTERS = ["Son 7 gün", "Son 30 gün", "Son 90 gün"];

const KPI_ITEMS = [
  { label: "Toplam Varlık", value: "8", sub: "2 yeni varlık", icon: Package },
  { label: "Aktif Bakım Kuralı", value: "12", sub: "3 kritik kural", icon: Wrench },
  { label: "Toplam Servis Maliyeti", value: "4.850 TL", sub: "Geçen aya göre -15%", icon: TrendingUp, accent: true },
  { label: "Belge Sayısı", value: "47", sub: "5 onay bekliyor", icon: FileText },
];

const RISK_ITEMS = [
  {
    title: "Klima B3 bakım tarihi yaklaşıyor",
    level: "Yüksek",
    due: "03 Mart 2026",
    amount: "1.250 TL",
    tone: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  },
  {
    title: "Jeneratör A1 için belge yenileme",
    level: "Orta",
    due: "07 Mart 2026",
    amount: "850 TL",
    tone: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  },
  {
    title: "Pompa C7 servis onayı bekliyor",
    level: "Düşük",
    due: "12 Mart 2026",
    amount: "420 TL",
    tone: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100",
  },
];

function DashboardViewComponent(_: PanelPreviewViewProps) {
  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_38%)] p-4 shadow-[0_12px_24px_rgb(5_10_24_/_28%)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold tracking-[0.15em] text-primary">
              Kontrol Merkezi
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--auth-foreground)]">Kontrol Merkezi</h3>
            <p className="mt-1 text-xs text-[var(--auth-muted)]">Özet metrikleri ve kritik riskleri tek panelde yönetin.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--auth-border-soft)] bg-[rgb(10_17_40_/_72%)] p-1">
              {DASHBOARD_FILTERS.map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                    index === 1
                      ? "border border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_90%)] text-[var(--auth-foreground)]"
                      : "text-[var(--auth-muted)] hover:bg-[rgb(17_29_58_/_64%)] hover:text-[var(--auth-foreground)]",
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/12 px-3 py-2 text-xs font-semibold text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              Hızlı Ekle
            </button>
          </div>
        </div>
      </article>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--auth-foreground)]">Özet Metrikler</h4>
          <span className="text-[11px] text-[var(--auth-muted)]">Son 30 gün trendi</span>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI_ITEMS.map((kpi) => (
            <article key={kpi.label} className="rounded-xl border border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_42%)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--auth-muted)]">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 text-[var(--auth-muted)]/80" />
              </div>
              <p className="text-2xl font-semibold text-[var(--auth-foreground)]">{kpi.value}</p>
              <p className={cn("mt-1 text-[11px] text-[var(--auth-muted)]", kpi.accent && "text-primary")}>{kpi.sub}</p>
            </article>
          ))}
        </div>
      </section>

      <article className="rounded-2xl border border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_38%)] p-4 shadow-[0_12px_24px_rgb(5_10_24_/_28%)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-semibold text-[var(--auth-foreground)]">Risk Paneli</span>
          </div>
          <span className="text-[11px] text-[var(--auth-muted)]">3 aktif kayıt</span>
        </div>
        <div className="space-y-2">
          {RISK_ITEMS.map((risk) => (
            <div
              key={risk.title}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--auth-border-soft)] bg-[rgb(10_17_40_/_58%)] px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-[var(--auth-foreground)]">{risk.title}</p>
                <p className="text-[11px] text-[var(--auth-muted)]">{risk.due}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded-md border px-2 py-0.5 text-[11px]", risk.tone)}>{risk.level}</span>
                <span className="text-xs font-semibold text-primary">{risk.amount}</span>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export const DashboardView = memo(DashboardViewComponent);
DashboardView.displayName = "DashboardView";
