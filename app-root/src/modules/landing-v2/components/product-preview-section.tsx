import {
  FileText,
  FolderOpen,
  HandCoins,
  Laptop,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
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
  meta: string;
  status: string;
  statusTone: StatusTone;
  highlight?: boolean;
};

const sidebarItems: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Gösterge", icon: LayoutDashboard, active: true },
  { label: "Varlıklar", icon: Package },
  { label: "Bakım", icon: Wrench },
  { label: "Belgeler", icon: FolderOpen },
  { label: "Giderler", icon: HandCoins },
  { label: "Fatura Takip", icon: Receipt },
  { label: "Raporlar", icon: FileText },
  { label: "Ayarlar", icon: Settings },
];

const assets: AssetRow[] = [
  {
    label: "Ofis Bilgisayarları",
    icon: Laptop,
    meta: "8 adet · Envanter güncel",
    status: "Aktif",
    statusTone: "normal",
  },
  {
    label: "Klima Sistemi",
    icon: Snowflake,
    meta: "Merkez ofis · 3 gün içinde bakım",
    status: "Dikkat",
    statusTone: "attention",
    highlight: true,
  },
  {
    label: "Ağ Altyapısı",
    icon: Wifi,
    meta: "3 switch · Aylık izleme aktif",
    status: "Aktif",
    statusTone: "normal",
  },
  {
    label: "Şirket Telefonları",
    icon: Smartphone,
    meta: "12 cihaz · Son kontrol: 5 gün önce",
    status: "Aktif",
    statusTone: "active",
  },
  {
    label: "Jeneratör",
    icon: Zap,
    meta: "Garanti süresi doldu · Bakım gerekli",
    status: "İncele",
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
    <section id="panel" className="relative px-4 pb-28 pt-20 sm:px-6 sm:pb-36 sm:pt-28">
      <div className="mx-auto max-w-7xl sm:px-6">
        {/* ── Text ── */}
        <div className="mx-auto max-w-2xl text-center" style={entrance(0)}>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
            Çoklu Platform
          </span>
          <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-5xl">
            Tüm cihazlarda{" "}
            <span className="text-gradient">kusursuz deneyim</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Varlıklarınızı, aboneliklerinizi ve giderlerinizi web, mobil ve tablet
            üzerinden takip edin. Her cihazda aynı düzenli deneyim.
          </p>
        </div>

        {/* ── Device wrapper ── */}
        <div
          className="relative mt-16 overflow-hidden sm:mt-20"
          style={entrance(120)}
        >
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 flex justify-center" aria-hidden>
            <div className="h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px]" />
          </div>

          {/* Device scene — mobile: flex-col, desktop: relative overlay */}
          <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 md:block" style={{ perspective: "1400px" }}>

            {/* ══ MONITOR ══ */}
            <div
              className="group relative z-10 w-full max-w-4xl mx-auto transform-gpu transition-transform duration-500 ease-out hover:scale-[1.02] md:[transform:rotateX(6deg)_rotateZ(-2deg)]"
              style={{ transformOrigin: "center bottom" }}
            >
              {/* Ground shadow */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 -bottom-10 h-14 rounded-[50%] bg-black/60 blur-3xl"
              />

              {/* Monitor outer shell */}
              <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#2c2c2e] to-[#1c1c1e] p-1 shadow-[0_60px_140px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.08] sm:p-1.5">
                {/* Inner screen */}
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0e1a] sm:rounded-[0.9rem]">
                  {/* Browser chrome bar */}
                  <div className="flex h-9 items-center gap-2 border-b border-white/[0.04] bg-[#161a2a] px-3 sm:px-4">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] shadow-[0_0_4px_rgba(255,95,87,0.4)]" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e] shadow-[0_0_4px_rgba(254,188,46,0.3)]" aria-hidden />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] shadow-[0_0_4px_rgba(40,200,64,0.3)]" aria-hidden />
                    <div className="ml-3 flex flex-1 items-center justify-center rounded-md bg-white/[0.05] px-3 py-1">
                      <span className="text-[10px] text-gray-500">🔒</span>
                      <span className="ml-1.5 text-[11px] tracking-wide text-gray-400">assetly.network</span>
                    </div>
                  </div>

                  {/* app body */}
                  <div className="relative flex max-h-[220px] flex-row overflow-hidden sm:max-h-[420px]">
                    {/* sidebar */}
                    <aside className="flex w-28 shrink-0 flex-col gap-1.5 border-r border-white/5 px-2 py-2 sm:w-52 sm:gap-4 sm:px-4 sm:py-5">
                      <div className="hidden items-center gap-2 sm:flex">
                        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/40 to-accent/30">
                          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/85" />
                        </span>
                        <span className="text-[13px] font-semibold tracking-tight text-foreground/90">Assetly</span>
                      </div>
                      <nav className="flex flex-col gap-0.5">
                        {sidebarItems.map((item) => {
                          const Icon = item.icon;
                          const active = Boolean(item.active);
                          return (
                            <div
                              key={item.label}
                              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 text-[10px] transition-colors sm:gap-2.5 sm:px-2.5 sm:py-1.5 sm:text-[12.5px] ${
                                active ? "bg-white/[0.06] text-foreground" : "text-muted-foreground/55"
                              }`}
                            >
                              <Icon aria-hidden className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${active ? "text-primary/80" : "text-muted-foreground/40"}`} strokeWidth={1.8} />
                              <span>{item.label}</span>
                            </div>
                          );
                        })}
                      </nav>
                    </aside>

                    {/* main */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2 sm:gap-3 sm:p-4 md:gap-6 md:p-7">
                      {/* today actions */}
                      <div className="rounded-lg bg-white/[0.025] px-2 py-1.5 sm:px-4 sm:py-3">
                        <p className="text-[8px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55 sm:text-[10.5px]">
                          Bugün dikkat edilmesi gerekenler
                        </p>
                        <ul className="mt-1 flex flex-col gap-1 text-[10px] sm:mt-2.5 sm:gap-1.5 sm:text-[13px]">
                          <li className="flex items-center gap-1 sm:gap-2">
                            <span className="h-1 w-1 shrink-0 rounded-full bg-amber-300/80 sm:h-1.5 sm:w-1.5" aria-hidden />
                            <span className="text-foreground/85">Klima Sistemi</span>
                            <span className="text-muted-foreground/35" aria-hidden>→</span>
                            <span className="text-muted-foreground/70">3 gün içinde bakım</span>
                          </li>
                          <li className="flex items-center gap-1 sm:gap-2">
                            <span className="h-1 w-1 shrink-0 rounded-full bg-rose-400/80 sm:h-1.5 sm:w-1.5" aria-hidden />
                            <span className="text-foreground/85">Jeneratör</span>
                            <span className="text-muted-foreground/35" aria-hidden>→</span>
                            <span className="text-muted-foreground/70">Garanti doldu, bakım planlanmalı</span>
                          </li>
                        </ul>
                      </div>

                      {/* header */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <h3 className="text-xs font-semibold text-foreground sm:text-base md:text-lg">
                            Varlıklarım
                          </h3>
                          <p className="text-[9px] text-muted-foreground/60 sm:text-xs">24 varlık · güncel</p>
                        </div>
                        <span className="hidden text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/40 sm:inline">Durum</span>
                      </div>

                      {/* asset list */}
                      <ul className="flex flex-col divide-y divide-white/[0.04]">
                        {assets.map((asset) => {
                          const Icon = asset.icon;
                          const tone = toneStyles[asset.statusTone];
                          return (
                            <li
                              key={asset.label}
                              className={`flex items-center gap-1.5 py-1 sm:gap-3 sm:py-2.5 md:py-3 ${
                                asset.highlight ? "-mx-2 rounded-lg bg-amber-400/[0.05] px-2 sm:-mx-3 sm:px-3" : ""
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] sm:h-9 sm:w-9 sm:rounded-lg ${
                                  asset.highlight ? "text-amber-200/90" : "text-muted-foreground/70"
                                }`}
                              >
                                <Icon className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={1.7} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[9px] font-medium text-foreground sm:text-[13px] md:text-sm">{asset.label}</p>
                                <p className="truncate text-[8px] text-muted-foreground/55 sm:text-[11px] md:text-xs">{asset.meta}</p>
                                {asset.highlight ? (
                                  <p className="mt-0.5 hidden truncate text-[10.5px] text-amber-200/70 sm:block">Bakım öncesi servis geçmişini kontrol edin</p>
                                ) : null}
                              </div>
                              <span className={`hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium sm:inline-flex ${tone.pill}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                                {asset.status}
                              </span>
                              <span className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full sm:hidden ${tone.dot}`} aria-hidden />
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Bottom fade overlay */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0a0e1a] to-transparent" aria-hidden />
                  </div>
                </div>
              </div>

              {/* Monitor stand */}
              <div aria-hidden className="mx-auto flex flex-col items-center">
                <div className="h-6 w-14 bg-gradient-to-b from-[#3a3a3c] to-[#2c2c2e] sm:h-10 sm:w-20" />
                <div className="h-1.5 w-24 rounded-b-lg bg-gradient-to-b from-[#3a3a3c] to-[#1c1c1e] shadow-[0_8px_16px_-6px_rgba(0,0,0,0.5)] sm:h-2.5 sm:w-36 sm:rounded-b-xl" />
              </div>
            </div>

            {/* ══ PHONE ══ */}
            <div
              className="group w-[180px] shrink-0 self-center transform-gpu transition-transform duration-500 ease-out hover:scale-[1.05] sm:w-[220px] md:absolute md:-right-4 md:top-12 md:z-20 md:[transform:rotateZ(8deg)_translateY(1.5rem)]"
            >
              {/* Ground shadow */}
              <div aria-hidden className="pointer-events-none absolute inset-x-4 -bottom-8 h-12 rounded-[50%] bg-black/50 blur-2xl" />

              {/* Phone outer shell (iPhone frame) */}
              <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#3a3a3c] via-[#2c2c2e] to-[#1c1c1e] p-[4px] shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]">
                {/* Side buttons — left */}
                <div aria-hidden className="absolute left-0 top-24 h-8 w-[3px] rounded-r-sm bg-[#2a2a2c]" />
                <div aria-hidden className="absolute left-0 top-36 h-12 w-[3px] rounded-r-sm bg-[#2a2a2c]" />
                <div aria-hidden className="absolute left-0 top-[12.5rem] h-12 w-[3px] rounded-r-sm bg-[#2a2a2c]" />
                {/* Side button — right */}
                <div aria-hidden className="absolute right-0 top-32 h-14 w-[3px] rounded-l-sm bg-[#2a2a2c]" />

                <div className="relative overflow-hidden rounded-[calc(2rem-4px)] bg-[#0a0e1a]">
                  {/* Notch / Dynamic Island */}
                  <div aria-hidden className="absolute left-1/2 top-2 z-10 flex h-[22px] w-[90px] -translate-x-1/2 items-center justify-end gap-1.5 rounded-full bg-black pr-3 shadow-[0_0_0_2px_rgba(0,0,0,0.8)]">
                    <span className="h-[6px] w-[6px] rounded-full bg-[#1a1a2e] ring-1 ring-white/[0.04]" />
                  </div>

                  {/* Status bar */}
                  <div className="flex items-center justify-between px-6 pt-3 text-[10px] text-muted-foreground/70">
                    <span className="font-semibold">09:41</span>
                    <div className="flex items-center gap-1 opacity-70">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                    </div>
                  </div>

                  {/* Screen content */}
                  <div className="flex flex-col gap-3.5 px-5 pb-6 pt-8">
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.12] text-primary/90 ring-1 ring-primary/20">
                        <LayoutDashboard className="h-5 w-5" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/55">Bugünkü Özet</p>
                        <h4 className="truncate text-[17px] font-semibold text-foreground">Assetly</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-amber-400/[0.1] px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" aria-hidden />
                      <span className="text-[11.5px] font-medium text-amber-100/90">3 bakım yaklaşıyor</span>
                    </div>

                    <dl className="flex flex-col gap-2.5 text-[12px]">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground/60">Toplam Varlık</dt>
                        <dd className="font-medium text-foreground/85">24</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground/60">Aylık Gider</dt>
                        <dd className="font-medium text-foreground/85">₺18.420</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground/60">Aktif Bakım</dt>
                        <dd className="font-medium text-foreground/85">12</dd>
                      </div>
                    </dl>

                    <div className="flex items-center gap-2 rounded-lg bg-emerald-400/[0.08] px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
                      <span className="text-[11.5px] font-medium text-emerald-200/90">₺1.240 tasarruf fırsatı</span>
                    </div>

                    <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground/55">
                      2 kullanılmayan varlık tespit edildi.
                    </p>
                  </div>

                  {/* Gesture bar */}
                  <div className="flex items-center justify-center pb-2">
                    <span aria-hidden className="h-1 w-24 rounded-full bg-white/25" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Trust indicators ── */}
        <div className="mt-16 flex flex-col items-center gap-4 sm:mt-20" style={entrance(360)}>
          <p className="text-sm font-medium text-muted-foreground/70">
            Web, Mobil ve Tablet üzerinde çalışır
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {([
              { label: "Windows", d: "M0 3.5l9.5-1.3v9.3H0zm10.5-1.5L22 0v11.5H10.5zM0 12.5h9.5v9.3L0 20.5zm10.5-.5H22V24l-11.5-2z" },
              { label: "macOS", d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79s-2 .77-3.27.82c-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87s2.26-1.07 3.8-.91c.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" },
              { label: "iOS", d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79s-2 .77-3.27.82c-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87s2.26-1.07 3.8-.91c.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" },
              { label: "Android", d: "M17.6 11.8V16a1 1 0 01-2 0v-4.2a1 1 0 012 0zm-11.2 0V16a1 1 0 01-2 0v-4.2a1 1 0 012 0zM15 4.3l1.2-1.2a.4.4 0 00-.56-.56L14.3 3.9A5 5 0 0012 3.4c-.8 0-1.6.2-2.3.5L8.4 2.5a.4.4 0 00-.56.56L9 4.3A4.5 4.5 0 007 8.1v.4h10v-.4a4.5 4.5 0 00-2-3.8zM10 6.5a.6.6 0 110-1.2.6.6 0 010 1.2zm4 0a.6.6 0 110-1.2.6.6 0 010 1.2zM7 8.5h10v6.5a2 2 0 01-2 2H9a2 2 0 01-2-2V8.5zm2 11v1.5a1 1 0 002 0V19.5h2v1.5a1 1 0 002 0V19.5" },
            ] as const).map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-xs text-muted-foreground/50">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d={p.d} /></svg>
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
        @media (prefers-reduced-motion: reduce) {
          [style*="landingV2PreviewIn"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}
