import Image from "next/image";
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
    <section id="panel" className="relative px-4 pb-28 pt-20 sm:px-6 sm:pb-36 sm:pt-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* ── Text ── */}
        <div className="mx-auto max-w-2xl text-center" style={entrance(0)}>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium tracking-wide text-primary">
            Çoklu Platform
          </span>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Tüm cihazlarda{" "}
            <span className="text-gradient">kusursuz deneyim</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Assetly ile varlıklarını web, mobil ve tablet üzerinden gerçek
            zamanlı yönet.
          </p>
        </div>

        {/* ── Device wrapper ── */}
        <div
          className="relative mt-16 sm:mt-20"
          style={entrance(120)}
        >
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 flex justify-center -z-10" aria-hidden>
            <div className="h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
          </div>

          {/* Device scene — mobile: stacked, desktop: layered */}
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:block">

            {/* ══ LAPTOP ══ */}
            <div className="relative z-10 w-full max-w-4xl mx-auto">
              <Image
                src="/mockups/macbook.svg"
                alt="Assetly dashboard on laptop"
                width={1440}
                height={920}
                className="w-full h-auto drop-shadow-[0_40px_100px_rgba(0,0,0,0.5)]"
                priority
              />
            </div>

            {/* ══ PHONE ══ */}
            <div className="w-[180px] md:w-[220px] mx-auto md:absolute md:right-0 md:top-10 md:z-20">
              <Image
                src="/mockups/iphone.svg"
                alt="Assetly mobile dashboard"
                width={390}
                height={844}
                className="w-full h-auto drop-shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              />
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
