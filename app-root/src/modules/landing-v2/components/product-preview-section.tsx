import {
  CreditCard,
  FileText,
  Package,
  Receipt,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

const navItems: NavItem[] = [
  { label: "Varlıklar", icon: Package, active: true },
  { label: "Bakım", icon: Wrench },
  { label: "Abonelikler", icon: CreditCard },
  { label: "Faturalar", icon: Receipt },
  { label: "Belgeler", icon: FileText },
];

export function ProductPreviewSection() {
  return (
    <section id="panel" className="relative isolate py-24 sm:py-32">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[720px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgb(7_14_32_/_85%)] shadow-[0_40px_120px_-40px_rgba(2,8,20,0.9)] backdrop-blur-xl">
          {/* browser frame */}
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3 sm:px-5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/30" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/30" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/30" aria-hidden />
            <div className="ml-4 hidden min-w-0 flex-1 items-center justify-center rounded-md bg-white/[0.03] px-3 py-1 text-[11px] text-muted-foreground/50 sm:flex">
              app.assetly.co/panel
            </div>
          </div>

          <div className="flex flex-col md:flex-row">
            {/* sidebar */}
            <aside className="flex shrink-0 flex-col gap-4 border-b border-white/[0.06] px-4 py-5 md:w-56 md:border-b-0 md:border-r md:px-5 md:py-7">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/40 via-primary/20 to-accent/30"
                >
                  <span className="h-3 w-3 rounded-sm bg-foreground/85" />
                </span>
                <span className="text-sm font-semibold tracking-tight text-foreground/85">Assetly</span>
              </div>

              <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-0.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = Boolean(item.active);
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-white/[0.05] text-foreground/90"
                          : "text-muted-foreground/55"
                      }`}
                    >
                      <Icon
                        aria-hidden
                        className={`h-4 w-4 ${isActive ? "text-primary/80" : "text-muted-foreground/45"}`}
                        strokeWidth={1.8}
                      />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* main content */}
            <div className="flex min-w-0 flex-1 flex-col px-4 py-5 sm:px-10 sm:py-10 md:px-14 md:py-14">
              {/* notification strip (subtle, not boxed) */}
              <div className="flex items-center gap-2.5 rounded-md bg-amber-400/[0.06] px-3 py-2 sm:gap-3 sm:px-3.5 sm:py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-amber-100/80 sm:text-[12px]">
                  Klima B3 bakım tarihi yaklaşıyor
                </p>
                <span className="hidden shrink-0 text-[10px] font-medium uppercase tracking-wider text-amber-200/50 sm:inline sm:text-[11px]">
                  3 gün
                </span>
              </div>

              {/* primary focus */}
              <div className="flex flex-col items-center py-6 sm:py-14">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/55 sm:text-[11px]">
                  Aktif Varlık
                </p>
                <p className="mt-2 text-[3.75rem] font-semibold leading-none tracking-tight text-foreground sm:mt-3 sm:text-[6rem]">
                  148
                </p>
                <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/65 sm:mt-4 sm:text-[13px]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" aria-hidden />
                    <span className="text-foreground/70">142</span>
                    <span>normal</span>
                  </span>
                  <span className="text-muted-foreground/25" aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" aria-hidden />
                    <span className="text-foreground/70">4</span>
                    <span>dikkat</span>
                  </span>
                  <span className="text-muted-foreground/25" aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400/80" aria-hidden />
                    <span className="text-foreground/70">2</span>
                    <span>gecikmiş</span>
                  </span>
                </p>
              </div>

              {/* operational row (inline, not cards) */}
              <div className="mt-auto flex flex-row flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-white/[0.05] pt-4 sm:gap-x-10 sm:pt-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 sm:text-[11px]">
                    Abonelik
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/85 sm:text-[13px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
                    Aktif
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 sm:text-[11px]">
                    Fatura
                  </span>
                  <span className="text-[12px] font-medium text-foreground/85 sm:text-[13px]">
                    <span className="text-amber-300/90">1</span>{" "}
                    <span className="text-foreground/70">bekleyen</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 sm:text-[11px]">
                    Belge
                  </span>
                  <span className="text-[12px] font-medium text-foreground/85 sm:text-[13px]">
                    <span className="text-rose-300/90">3</span>{" "}
                    <span className="text-foreground/70">eksik</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
