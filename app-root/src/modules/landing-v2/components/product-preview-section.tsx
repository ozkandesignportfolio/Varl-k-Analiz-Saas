import {
  Bell,
  CreditCard,
  FileText,
  GraduationCap,
  Laptop,
  Package,
  Receipt,
  Smartphone,
  Snowflake,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type StatusTone = "normal" | "attention" | "active" | "pending";

type AssetRow = {
  label: string;
  icon: LucideIcon;
  status: string;
  statusTone: StatusTone;
  meta: string;
  highlight?: boolean;
};

const sidebarItems = [
  { label: "Varlıklar", icon: Package, active: true },
  { label: "Bakım", icon: Wrench },
  { label: "Abonelikler", icon: CreditCard },
  { label: "Faturalar", icon: Receipt },
  { label: "Belgeler", icon: FileText },
];

const assets: AssetRow[] = [
  {
    label: "Telefon",
    icon: Smartphone,
    status: "Normal",
    statusTone: "normal",
    meta: "Garanti devam ediyor",
  },
  {
    label: "Klima",
    icon: Snowflake,
    status: "Dikkat",
    statusTone: "attention",
    meta: "Bakıma 3 gün kaldı",
    highlight: true,
  },
  {
    label: "Dizüstü Bilgisayar",
    icon: Laptop,
    status: "Normal",
    statusTone: "normal",
    meta: "Garantiye 6 ay kaldı",
  },
  {
    label: "İnternet Aboneliği",
    icon: Wifi,
    status: "Aktif",
    statusTone: "active",
    meta: "Yenilemeye 5 gün",
  },
  {
    label: "Dijital Eğitim Aboneliği",
    icon: GraduationCap,
    status: "Aktif",
    statusTone: "active",
    meta: "Aylık ödeme",
  },
  {
    label: "Elektrik Faturası",
    icon: Zap,
    status: "Bekliyor",
    statusTone: "pending",
    meta: "Son ödemeye 2 gün",
  },
];

const toneStyles: Record<StatusTone, { dot: string; text: string; pill: string }> = {
  normal: {
    dot: "bg-emerald-400/70",
    text: "text-emerald-300/90",
    pill: "bg-emerald-400/10 text-emerald-200/90",
  },
  attention: {
    dot: "bg-amber-300/80",
    text: "text-amber-200/90",
    pill: "bg-amber-400/10 text-amber-200/90",
  },
  active: {
    dot: "bg-sky-400/80",
    text: "text-sky-200/90",
    pill: "bg-sky-400/10 text-sky-200/90",
  },
  pending: {
    dot: "bg-rose-400/80",
    text: "text-rose-200/90",
    pill: "bg-rose-400/10 text-rose-200/90",
  },
};

export function ProductPreviewSection() {
  return (
    <section id="panel" className="relative px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[520px] w-[720px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="mx-auto mt-20 max-w-6xl sm:mt-24">
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          {/* LEFT — DESKTOP / BROWSER VIEW */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_30px_90px_-40px_rgba(2,8,20,0.8)] backdrop-blur-xl">
            {/* browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/30" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/30" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/30" aria-hidden />
            </div>

            <div className="flex flex-col sm:flex-row">
              {/* sidebar */}
              <aside className="flex shrink-0 flex-col gap-4 border-b border-white/5 px-4 py-4 sm:w-48 sm:border-b-0 sm:border-r sm:py-6">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/40 to-accent/30"
                  >
                    <span className="h-2.5 w-2.5 rounded-sm bg-foreground/85" />
                  </span>
                  <span className="text-sm font-semibold tracking-tight text-foreground/90">Assetly</span>
                </div>
                <nav className="flex flex-row gap-1 overflow-x-auto text-sm sm:flex-col sm:gap-0.5">
                  {sidebarItems.map((item) => {
                    const Icon = item.icon;
                    const active = Boolean(item.active);
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] ${
                          active
                            ? "bg-white/[0.06] text-foreground"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        <Icon
                          aria-hidden
                          className={`h-4 w-4 ${active ? "text-primary/80" : "text-muted-foreground/45"}`}
                          strokeWidth={1.8}
                        />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </nav>
              </aside>

              {/* main content */}
              <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:gap-6 sm:p-7">
                {/* notification */}
                <div className="flex items-center gap-2.5 rounded-lg bg-amber-400/[0.08] px-3 py-2">
                  <Bell className="h-3.5 w-3.5 text-amber-300/80" aria-hidden strokeWidth={2} />
                  <span className="text-[12px] font-medium text-amber-100/90 sm:text-[13px]">
                    1 bakım yaklaşıyor
                  </span>
                  <span className="ml-auto text-[11px] text-amber-200/50">Klima · 3 gün</span>
                </div>

                {/* today actions */}
                <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/55">
                    Bugün ilgilenmen gerekenler
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-[12px] sm:text-[13px]">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
                      <span className="text-foreground/85">Klima</span>
                      <span className="text-muted-foreground/40" aria-hidden>→</span>
                      <span className="text-muted-foreground/70">3 gün içinde bakım</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/80" aria-hidden />
                      <span className="text-foreground/85">Elektrik faturası</span>
                      <span className="text-muted-foreground/40" aria-hidden>→</span>
                      <span className="text-muted-foreground/70">2 gün kaldı</span>
                    </li>
                  </ul>
                </div>

                {/* header */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground sm:text-lg">Varlıklarım</h3>
                    <p className="text-xs text-muted-foreground/60">6 kayıt · güncel</p>
                  </div>
                  <span className="hidden text-[11px] uppercase tracking-[0.18em] text-muted-foreground/40 sm:inline">
                    Durum
                  </span>
                </div>

                {/* asset list */}
                <ul className="flex flex-col divide-y divide-white/[0.04]">
                  {assets.map((asset) => {
                    const Icon = asset.icon;
                    const tone = toneStyles[asset.statusTone];
                    return (
                      <li
                        key={asset.label}
                        className={`flex items-center gap-3 py-2.5 sm:py-3 ${
                          asset.highlight ? "-mx-3 rounded-lg bg-amber-400/[0.05] px-3" : ""
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] ${
                            asset.highlight ? "text-amber-200/90" : "text-muted-foreground/70"
                          }`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.7} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-medium text-foreground sm:text-sm">
                              {asset.label}
                            </p>
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground/55 sm:text-xs">
                            {asset.meta}
                          </p>
                          {asset.highlight ? (
                            <p className="mt-0.5 truncate text-[10.5px] text-amber-200/70 sm:text-[11px]">
                              Bakım gecikirse performans düşebilir
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${tone.pill}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                          {asset.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* RIGHT — MOBILE DETAIL VIEW */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[280px] overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-2.5 shadow-[0_40px_80px_-30px_rgba(2,8,20,0.9)] backdrop-blur-xl">
              {/* notch */}
              <div className="mx-auto mb-2 h-1 w-16 rounded-full bg-white/10" aria-hidden />

              <div className="overflow-hidden rounded-[1.5rem] border border-white/5 bg-[rgb(7_14_32_/_75%)]">
                {/* status bar */}
                <div className="flex items-center justify-between px-5 pt-4 text-[10px] text-muted-foreground/60">
                  <span>09:41</span>
                  <div className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/60" aria-hidden />
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/60" aria-hidden />
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/60" aria-hidden />
                  </div>
                </div>

                {/* screen content */}
                <div className="flex flex-col gap-5 px-5 pb-5 pt-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-amber-400/[0.08] text-amber-200/90"
                    >
                      <Snowflake className="h-5 w-5" strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
                        Varlık
                      </p>
                      <h4 className="truncate text-base font-semibold text-foreground">Klima</h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" aria-hidden />
                    <span className="text-[11px] font-medium text-amber-100/90">
                      3 gün içinde bakım gerekli
                    </span>
                  </div>

                  <dl className="flex flex-col gap-3 text-[12px]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground/60">Durum</dt>
                      <dd className="inline-flex items-center gap-1.5 text-amber-200/90">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" aria-hidden />
                        Dikkat
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground/60">Son bakım</dt>
                      <dd className="text-foreground/85">6 ay önce</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground/60">Sonraki bakım</dt>
                      <dd className="text-foreground/85">3 gün kaldı</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-t border-white/5 pt-3">
                      <dt className="text-muted-foreground/60">Not</dt>
                      <dd className="max-w-[60%] text-right text-foreground/75">
                        Filtre temizliği
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="mt-1 w-full rounded-xl bg-gradient-to-b from-primary to-primary/80 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_rgba(59,130,246,0.6)]"
                  >
                    Bakımı planla
                  </button>

                  <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground/60">
                    Bu işlem zamanında yapılmazsa cihaz verimi düşebilir.
                  </p>
                </div>

                {/* home indicator */}
                <div className="mx-auto mb-2 h-1 w-20 rounded-full bg-white/15" aria-hidden />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/60 sm:mt-10 sm:text-sm">
          Tüm varlıklarını tek yerden takip et, hiçbir şeyi kaçırma.
        </p>
      </div>
    </section>
  );
}
