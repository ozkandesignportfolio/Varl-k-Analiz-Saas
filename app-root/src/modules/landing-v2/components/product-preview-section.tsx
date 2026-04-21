import {
  Activity,
  Bell,
  ClipboardList,
  CreditCard,
  FileText,
  Laptop,
  Package,
  Smartphone,
  Snowflake,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type StatusTone = "normal" | "attention" | "active" | "pending";

type AssetRow = {
  label: string;
  icon: LucideIcon;
  meta: string;
  status: string;
  statusTone: StatusTone;
  highlight?: boolean;
};

const sidebarItems: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Varlıklar", icon: Package, active: true },
  { label: "Bakım", icon: Wrench },
  { label: "Servis Kayıtları", icon: ClipboardList },
  { label: "Belgeler", icon: FileText },
  { label: "Zaman Akışı", icon: Activity },
  { label: "Giderler", icon: Wallet },
  { label: "Bildirimler", icon: Bell },
  { label: "Abonelikler", icon: CreditCard },
];

const assets: AssetRow[] = [
  {
    label: "Telefon",
    icon: Smartphone,
    meta: "Garanti devam ediyor",
    status: "Normal",
    statusTone: "normal",
  },
  {
    label: "Klima",
    icon: Snowflake,
    meta: "3 gün içinde bakım gerekli",
    status: "Dikkat",
    statusTone: "attention",
    highlight: true,
  },
  {
    label: "Dizüstü Bilgisayar",
    icon: Laptop,
    meta: "Garantiye 6 ay kaldı",
    status: "Normal",
    statusTone: "normal",
  },
  {
    label: "İnternet Aboneliği",
    icon: Wifi,
    meta: "Yenilemeye 5 gün",
    status: "Aktif",
    statusTone: "active",
  },
  {
    label: "Elektrik Faturası",
    icon: Zap,
    meta: "Ödeme bekliyor · 2 gün",
    status: "Bekliyor",
    statusTone: "pending",
  },
];

const toneStyles: Record<StatusTone, { dot: string; pill: string }> = {
  normal: {
    dot: "bg-emerald-400/70",
    pill: "bg-emerald-400/10 text-emerald-200/90",
  },
  attention: {
    dot: "bg-amber-300/80",
    pill: "bg-amber-400/10 text-amber-200/90",
  },
  active: {
    dot: "bg-sky-400/80",
    pill: "bg-sky-400/10 text-sky-200/90",
  },
  pending: {
    dot: "bg-rose-400/80",
    pill: "bg-rose-400/10 text-rose-200/90",
  },
};

const entrance = (delayMs: number) => ({
  animation: "landingV2PreviewIn 500ms ease-out both",
  animationDelay: `${delayMs}ms`,
});

export function ProductPreviewSection() {
  return (
    <section id="panel" className="relative px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[40%] -z-10 h-[600px] w-[900px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(16,239,181,0.08)_0%,rgba(44,247,255,0.04)_35%,transparent_70%)] blur-[100px]"
      />

      <div className="mx-auto max-w-6xl">
        {/* heading */}
        <div className="mx-auto max-w-2xl text-center" style={entrance(0)}>
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
            Çoklu Platform
          </span>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Tüm cihazlardan eriş,{" "}
            <span className="text-gradient">her yerden yönet</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Assetly ile varlıklarını web, mobil ve tablet üzerinden gerçek zamanlı
            senkronize şekilde yönet. Tek panel, tüm cihazlar.
          </p>
        </div>

        {/* Device composition */}
        <div className="group/devices relative mt-16 sm:mt-20">
          {/* LAPTOP */}
          <div className="relative mx-auto w-full max-w-4xl" style={entrance(120)}>
            {/* shadow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-10 -bottom-8 h-12 rounded-[50%] bg-black/50 blur-2xl transition-all duration-500 group-hover/devices:blur-3xl"
            />
            {/* glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/8 to-transparent blur-2xl"
            />

            <div
              className="device-hover-tilt relative transition-transform duration-500 ease-out lg:[transform:perspective(2200px)_rotateX(4deg)_rotateY(-1deg)]"
              style={{ transformOrigin: "center bottom" }}
            >
              {/* laptop lid */}
              <div className="rounded-t-[1.25rem] bg-gradient-to-b from-zinc-700/90 to-zinc-900 p-[6px] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85),0_0_60px_-20px_rgba(16,239,181,0.08)] ring-1 ring-white/[0.07] sm:rounded-t-[1.5rem] sm:p-[8px]">
                {/* camera */}
                <div className="relative mx-auto mb-[6px] flex h-2 items-center justify-center sm:mb-2">
                  <span
                    aria-hidden
                    className="h-1 w-1 rounded-full bg-zinc-600 shadow-[inset_0_0_2px_rgba(255,255,255,0.3)] sm:h-1.5 sm:w-1.5"
                  />
                </div>

                {/* screen */}
                <div className="overflow-hidden rounded-[0.85rem] border border-white/[0.06] bg-[rgb(6_10_24)] sm:rounded-[1rem]">
                  {/* browser chrome */}
                  <div className="flex items-center gap-2 border-b border-white/5 bg-black/40 px-3 py-2 sm:px-4 sm:py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" aria-hidden />
                    <div className="ml-3 hidden min-w-0 flex-1 items-center justify-center rounded-md bg-white/[0.04] px-3 py-1 sm:flex">
                      <span className="text-[10px] text-muted-foreground/40">🔒</span>
                      <span className="ml-1.5 text-[11px] text-muted-foreground/60">assetly.network</span>
                    </div>
                  </div>

                  {/* app body */}
                  <div className="flex min-h-[420px] flex-col sm:flex-row">
                    {/* sidebar */}
                    <aside className="flex shrink-0 flex-col gap-4 border-b border-white/5 px-3 py-4 sm:w-52 sm:border-b-0 sm:border-r sm:px-4 sm:py-5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/40 to-accent/30"
                        >
                          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/85" />
                        </span>
                        <span className="text-[13px] font-semibold tracking-tight text-foreground/90">
                          Assetly
                        </span>
                      </div>

                      <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:gap-0.5">
                        {sidebarItems.map((item) => {
                          const Icon = item.icon;
                          const active = Boolean(item.active);
                          return (
                            <div
                              key={item.label}
                              className={`flex items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors ${
                                active
                                  ? "bg-white/[0.06] text-foreground"
                                  : "text-muted-foreground/55"
                              }`}
                            >
                              <Icon
                                aria-hidden
                                className={`h-3.5 w-3.5 ${active ? "text-primary/80" : "text-muted-foreground/40"}`}
                                strokeWidth={1.8}
                              />
                              <span>{item.label}</span>
                            </div>
                          );
                        })}
                      </nav>
                    </aside>

                    {/* main */}
                    <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:gap-6 sm:p-7">
                      {/* today actions */}
                      <div className="rounded-lg bg-white/[0.025] px-4 py-3">
                        <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55">
                          Bugün ilgilenmen gerekenler
                        </p>
                        <ul className="mt-2.5 flex flex-col gap-1.5 text-[12.5px] sm:text-[13px]">
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" aria-hidden />
                            <span className="text-foreground/85">Klima</span>
                            <span className="text-muted-foreground/35" aria-hidden>→</span>
                            <span className="text-muted-foreground/70">3 gün içinde bakım</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400/80" aria-hidden />
                            <span className="text-foreground/85">Elektrik faturası</span>
                            <span className="text-muted-foreground/35" aria-hidden>→</span>
                            <span className="text-muted-foreground/70">2 gün kaldı</span>
                          </li>
                        </ul>
                      </div>

                      {/* header */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-foreground sm:text-lg">
                            Varlıklarım
                          </h3>
                          <p className="text-xs text-muted-foreground/60">5 kayıt · güncel</p>
                        </div>
                        <span className="hidden text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/40 sm:inline">
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
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ${
                                  asset.highlight ? "text-amber-200/90" : "text-muted-foreground/70"
                                }`}
                              >
                                <Icon className="h-4 w-4" strokeWidth={1.7} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-foreground sm:text-sm">
                                  {asset.label}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground/55 sm:text-xs">
                                  {asset.meta}
                                </p>
                                {asset.highlight ? (
                                  <p className="mt-0.5 truncate text-[10.5px] text-amber-200/70">
                                    Bakım gecikirse performans düşebilir
                                  </p>
                                ) : null}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${tone.pill}`}
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
              </div>

              {/* laptop base */}
              <div
                aria-hidden
                className="relative mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-[1.25rem] bg-gradient-to-b from-zinc-700/80 via-zinc-900 to-black shadow-[0_12px_20px_-10px_rgba(0,0,0,0.7)] sm:h-4 sm:rounded-b-[1.5rem]"
              >
                <span className="absolute left-1/2 top-0 h-[3px] w-16 -translate-x-1/2 rounded-b-md bg-black/70 sm:w-24" />
              </div>
            </div>
          </div>

          {/* PHONE — overlaps laptop on desktop */}
          <div
            className="mt-8 flex justify-center sm:mt-0 sm:absolute sm:bottom-4 sm:right-0 lg:-bottom-4 lg:right-[2%]"
            style={entrance(240)}
          >
            <div className="relative">
              {/* shadow */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 -bottom-6 h-8 rounded-[50%] bg-black/50 blur-xl"
              />

              <div className="device-hover-tilt relative w-[220px] rounded-[2.25rem] bg-gradient-to-b from-zinc-700/90 to-zinc-900 p-[4px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8),0_0_40px_-15px_rgba(16,239,181,0.06)] ring-1 ring-white/[0.08] sm:w-[248px] lg:[transform:perspective(2200px)_rotateX(2deg)_rotateY(3deg)]">
                {/* inner bezel */}
                <div className="relative overflow-hidden rounded-[2rem] bg-[rgb(6_10_24)]">
                  {/* notch */}
                  <div
                    aria-hidden
                    className="absolute left-1/2 top-1.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
                  />

                  {/* status bar */}
                  <div className="flex items-center justify-between px-5 pt-2.5 text-[10px] text-muted-foreground/70">
                    <span className="font-medium">09:41</span>
                    <div className="flex items-center gap-1 opacity-70">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                    </div>
                  </div>

                  {/* screen content */}
                  <div className="flex flex-col gap-4 px-5 pb-6 pt-8">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/[0.1] text-amber-200/90 ring-1 ring-amber-400/20"
                      >
                        <Snowflake className="h-5 w-5" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/55">
                          Varlık
                        </p>
                        <h4 className="truncate text-[17px] font-semibold text-foreground">Klima</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-amber-400/[0.1] px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" aria-hidden />
                      <span className="text-[11.5px] font-medium text-amber-100/90">
                        3 gün içinde bakım gerekli
                      </span>
                    </div>

                    <dl className="flex flex-col gap-2.5 text-[12px]">
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
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground/60">Not</dt>
                        <dd className="max-w-[60%] text-right text-foreground/80">Filtre temizliği</dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      className="mt-1 w-full rounded-xl bg-gradient-to-b from-primary to-primary/85 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_10px_25px_-10px_rgba(59,130,246,0.55)]"
                    >
                      Bakımı planla
                    </button>

                    <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground/55">
                      Bu işlem zamanında yapılmazsa cihaz verimi düşebilir.
                    </p>
                  </div>

                  {/* gesture bar */}
                  <div className="flex items-center justify-center pb-2">
                    <span
                      aria-hidden
                      className="h-1 w-24 rounded-full bg-white/25"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-14 flex flex-col items-center gap-4 sm:mt-16" style={entrance(360)}>
          <p className="text-sm font-medium text-muted-foreground/70">
            Web, Mobil ve Tablet üzerinde çalışır
          </p>
          <div className="flex items-center gap-5">
            {[
              { label: "Windows", icon: "⊞" },
              { label: "macOS", icon: "" },
              { label: "iOS", icon: "" },
              { label: "Android", icon: "🤖" },
            ].map((p) => (
              <div
                key={p.label}
                className="flex items-center gap-1.5 text-xs text-muted-foreground/50"
              >
                <span className="text-sm">{p.icon}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes landingV2PreviewIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .device-hover-tilt {
          transition: transform 500ms ease-out;
        }
        .group\/devices:hover .device-hover-tilt {
          transform: perspective(2200px) rotateX(2deg) rotateY(0deg) scale(1.01) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="landingV2PreviewIn"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .device-hover-tilt {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
