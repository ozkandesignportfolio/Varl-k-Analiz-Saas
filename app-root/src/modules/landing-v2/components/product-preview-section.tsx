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
            <div className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-10 sm:py-10 md:px-14 md:py-14">
              {/* notification strip */}
              <div className="flex items-center gap-3 rounded-lg bg-rose-500/[0.07] px-3.5 py-2.5 sm:px-4">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                <Wrench className="hidden h-3.5 w-3.5 text-rose-300/60 sm:block" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-rose-200/80 sm:text-xs">
                  <span className="sm:hidden">Bakım gecikmesi</span>
                  <span className="hidden sm:inline">
                    Klima B3 — Aylık filtre değişimi
                    <span className="mx-2 text-muted-foreground/30" aria-hidden>
                      ·
                    </span>
                    2 gün gecikti
                  </span>
                </p>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-rose-300/50 sm:text-[11px]">
                  Görüntüle
                </span>
              </div>

              {/* primary metric */}
              <div className="flex flex-col items-center py-10 sm:py-16">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground/50 sm:text-[11px]">
                  Aktif Varlık
                </p>
                <p className="mt-3 text-[3.5rem] font-semibold leading-none tracking-tight text-foreground sm:text-[5rem]">
                  148
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300/70 sm:text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" aria-hidden />
                    +8.4%
                  </span>
                  <span className="hidden text-[11px] text-muted-foreground/45 sm:inline sm:text-xs">
                    Son 30 günde 12 yeni kayıt
                  </span>
                </div>
              </div>

              {/* status row */}
              <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.05] pt-5 sm:mt-0 sm:flex-row sm:gap-0 sm:pt-6">
                <div className="flex flex-1 items-center gap-3 sm:pr-6">
                  <CreditCard className="h-4 w-4 shrink-0 text-primary/60" aria-hidden strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground/85 sm:text-[13px]">Premium Plan</p>
                    <p className="truncate text-[11px] text-muted-foreground/50 sm:text-xs">23 Mar 2026 yenileme</p>
                  </div>
                </div>

                <div className="flex flex-1 items-center gap-3 sm:border-l sm:border-white/[0.05] sm:pl-6">
                  <Receipt className="h-4 w-4 shrink-0 text-accent/70" aria-hidden strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground/85 sm:text-[13px]">Açık Fatura</p>
                    <p className="truncate text-[11px] text-muted-foreground/50 sm:text-xs">3.420 ₺ · 24 Mar vade</p>
                  </div>
                </div>

                <div className="hidden flex-1 items-center gap-3 sm:flex sm:border-l sm:border-white/[0.05] sm:pl-6">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden strokeWidth={1.8} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground/85">4 Belge</p>
                    <p className="truncate text-xs text-muted-foreground/50">Doğrulama bekliyor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
