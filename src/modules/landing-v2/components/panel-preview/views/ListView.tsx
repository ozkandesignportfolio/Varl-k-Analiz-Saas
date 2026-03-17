import { memo } from "react";
import type { PanelPreviewViewProps } from "@/modules/landing-v2/components/panel-preview/types";

const badgeClassByLabel: Record<string, string> = {
  Kritik: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  Uyarı: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  Bilgi: "border-sky-300/35 bg-sky-300/10 text-sky-100",
  Gecikme: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  Yaklaşıyor: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  Bekliyor: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  Onaylandı: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Tamamlandı: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Güncel: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Aktif: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
};

function ListViewComponent({ rows }: PanelPreviewViewProps) {
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const badgeClass =
          badgeClassByLabel[row.badge] ??
          "border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_38%)] text-[var(--auth-foreground)]";

        return (
          <article
            key={`${row.title}-${row.date}`}
            className="auth-list-row rounded-xl px-4 py-3 shadow-[0_10px_24px_rgb(5_10_24_/_26%)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--auth-foreground)]">{row.title}</p>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}>
                    {row.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--auth-muted)]">{row.detail}</p>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-4 sm:block sm:text-right">
                <p className="text-[11px] text-[var(--auth-muted)]">{row.date}</p>
                <p className="mt-1 text-sm font-semibold text-[#EAF2FF]">{row.amount}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export const ListView = memo(ListViewComponent);
ListView.displayName = "ListView";
