import { memo } from "react";
import type { PanelPreviewViewProps } from "@/modules/landing-v2/components/panel-preview/types";

const badgeClassByLabel: Record<string, string> = {
  Kritik: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  Uyarı: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  Bilgi: "border-sky-300/35 bg-sky-300/10 text-sky-100",
  Gecikme: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  Yaklaşıyor: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  "Bakım Yaklaşıyor": "border-amber-300/35 bg-amber-300/10 text-amber-100",
  "Garanti Bitiyor": "border-amber-300/35 bg-amber-300/10 text-amber-100",
  "Belge Eksik": "border-rose-300/35 bg-rose-300/10 text-rose-100",
  Bekliyor: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  Planlandı: "border-sky-300/35 bg-sky-300/10 text-sky-100",
  İnceleniyor: "border-sky-300/35 bg-sky-300/10 text-sky-100",
  Onaylandı: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Tamamlandı: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Hazır: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Ödendi: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Güncel: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Aktif: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  Yenileniyor: "border-amber-300/35 bg-amber-300/10 text-amber-100",
};

function ListViewComponent({ rows, menuItem }: PanelPreviewViewProps) {
  return (
    <div className="rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.13),transparent_56%)] p-2 sm:p-3">
      <section className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(145deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#90A6C4]">{menuItem.label}</p>
            <h4 className="mt-1 text-lg font-semibold text-[#F8FAFC]">{menuItem.title} önizleme</h4>
            <p className="mt-1 text-sm text-[#9FB2CE]">{menuItem.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#345073] bg-[#102643] px-2.5 py-1 text-xs font-semibold text-[#C3D7F4]">
              {rows.length} kayıt
            </span>
            <span className="inline-flex rounded-full border border-[#29425F] bg-[#0B1730]/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8FA6C7]">
              {menuItem.badge}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {rows.map((row) => {
            const badgeClass =
              badgeClassByLabel[row.badge] ??
              "border-[var(--auth-border-soft)] bg-[rgb(17_29_58_/_38%)] text-[var(--auth-foreground)]";

            return (
              <article
                key={`${row.title}-${row.date}`}
                className="rounded-xl border border-[#314866] bg-[#0E1E37]/75 px-4 py-3 shadow-[0_10px_24px_rgb(5_10_24_/_26%)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#EAF2FF]">{row.title}</p>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}
                      >
                        {row.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#9FB2CE]">{row.detail}</p>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-4 sm:block sm:text-right">
                    <p className="text-[11px] text-[#9FB2CE]">{row.date}</p>
                    <p className="mt-1 text-sm font-semibold text-[#EAF2FF]">{row.amount}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export const ListView = memo(ListViewComponent);
ListView.displayName = "ListView";
