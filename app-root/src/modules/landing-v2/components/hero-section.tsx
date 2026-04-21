"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CreditCard,
  FileText,
  Laptop,
  Package,
  Smartphone,
  Snowflake,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type AssetRow = {
  label: string;
  icon: LucideIcon;
  status: "normal" | "attention" | "active" | "pending";
  meta: string;
  highlight?: boolean;
};

const sidebarItems: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Varlıklar", icon: Package, active: true },
  { label: "Bakım", icon: Wrench },
  { label: "Abonelikler", icon: CreditCard },
  { label: "Faturalar", icon: FileText },
  { label: "Bildirimler", icon: Bell },
];

const laptopAssets: AssetRow[] = [
  { label: "Telefon", icon: Smartphone, status: "normal", meta: "Garanti devam ediyor" },
  { label: "Klima", icon: Snowflake, status: "attention", meta: "Bakıma 3 gün kaldı", highlight: true },
  { label: "İnternet Aboneliği", icon: Wifi, status: "active", meta: "Yenilemeye 5 gün" },
  { label: "Elektrik Faturası", icon: Zap, status: "pending", meta: "Ödemeye 2 gün" },
];

const statusTone: Record<AssetRow["status"], { dot: string; pill: string; label: string }> = {
  normal: { dot: "bg-emerald-400/80", pill: "bg-emerald-400/10 text-emerald-200/90", label: "Normal" },
  attention: { dot: "bg-amber-300/80", pill: "bg-amber-400/10 text-amber-200/90", label: "Dikkat" },
  active: { dot: "bg-sky-400/80", pill: "bg-sky-400/10 text-sky-200/90", label: "Aktif" },
  pending: { dot: "bg-rose-400/80", pill: "bg-rose-400/10 text-rose-200/90", label: "Bekliyor" },
};

function useMouseParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reduce?.matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const x = (e.clientX - cx) / Math.max(rect.width, 1);
        const y = (e.clientY - cy) / Math.max(rect.height, 1);
        setTilt({
          x: Math.max(-1, Math.min(1, x)),
          y: Math.max(-1, Math.min(1, y)),
        });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, tilt };
}

export function HeroSection() {
  const { ref, tilt } = useMouseParallax();

  const laptopTransform = `translate3d(${tilt.x * -10}px, ${tilt.y * -6}px, 0)`;
  const phoneTransform = `translate3d(${tilt.x * 14}px, ${tilt.y * 8}px, 0)`;
  const backdropTransform = `translate3d(${tilt.x * -18}px, ${tilt.y * -10}px, 0)`;

  return (
    <section className="relative isolate overflow-x-clip pb-24 pt-28 sm:pb-28 sm:pt-32 lg:min-h-[100svh] lg:pb-0 lg:pt-0">
      {/* Base gradient: dark navy → black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(20,40,80,0.55),transparent_60%),linear-gradient(180deg,#05070f_0%,#030509_100%)]"
      />
      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:3px_3px]"
      />
      {/* Ambient color glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] -z-10 hidden h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-400/[0.08] blur-[140px] sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[55%] -z-10 hidden h-[360px] w-[480px] rounded-full bg-primary/[0.1] blur-[120px] lg:block"
      />

      <div
        ref={ref}
        className="relative z-10 mx-auto flex h-full max-w-7xl flex-col items-center gap-12 px-5 sm:px-6 lg:min-h-[100svh] lg:flex-row lg:items-center lg:gap-10 lg:py-24"
      >
        {/* LEFT — Copy */}
        <div className="w-full max-w-2xl text-center lg:max-w-[560px] lg:text-left">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-[11px] font-medium text-primary/90 sm:text-xs"
            style={heroEntrance(0)}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Yeni: Skor Analizi ve Fatura Takip
          </div>

          <h1
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-[64px]"
            style={heroEntrance(80)}
          >
            Varlıklarını <span className="text-gradient">tek merkezden</span> yönet.
          </h1>

          <p
            className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg lg:mx-0"
            style={heroEntrance(160)}
          >
            Cihazların, aboneliklerin ve bakım süreçlerin tek bir ekranda. Zamanını yönet, hiçbir
            yenilemeyi ve bakım tarihini kaçırma.
          </p>

          <div
            className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-3.5 lg:justify-start"
            style={heroEntrance(240)}
          >
            <Button
              asChild
              size="lg"
              className="group h-12 bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_16px_40px_-12px_rgba(56,120,255,0.55)] hover:bg-primary/90 focus-visible:ring-primary/70"
            >
              <Link href="/register">
                Ücretsiz başla
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/15 bg-white/[0.03] px-7 text-[15px] font-medium text-foreground backdrop-blur-sm hover:border-white/25 hover:bg-white/[0.06] focus-visible:ring-primary/50"
            >
              <Link href="#panel">Demo incele</Link>
            </Button>
          </div>

          <p
            className="mt-5 text-xs text-muted-foreground/70 sm:mt-6 sm:text-[13px]"
            style={heroEntrance(320)}
          >
            Kurulum gerektirmez · 2 dakikada hazır · Ücretsiz plan
          </p>
        </div>

        {/* RIGHT — Device composition */}
        <div
          className="relative mx-auto w-full max-w-[620px] lg:ml-auto lg:mr-0"
          style={heroEntrance(180)}
        >
          {/* backdrop surface + ambient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-4 bottom-6 top-10 -z-10 rounded-[2.5rem] bg-gradient-to-b from-white/[0.03] to-white/0"
            style={{ transform: backdropTransform }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-8 top-4 -z-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl"
            style={{ transform: backdropTransform }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-4 -z-10 h-48 w-48 rounded-full bg-fuchsia-400/10 blur-3xl"
          />

          <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px] sm:aspect-[16/11]">
            {/* LAPTOP */}
            <div
              className="absolute left-1/2 top-2 w-[88%] -translate-x-1/2 will-change-transform sm:w-[86%]"
              style={{
                transform: `${laptopTransform}`,
                animation: "landingV2DeviceFloat 8s ease-in-out infinite",
              }}
            >
              <Laptop3D />
            </div>

            {/* PHONE — overlapping in front */}
            <div
              className="absolute bottom-0 left-1/2 w-[40%] -translate-x-[78%] will-change-transform sm:left-auto sm:right-2 sm:w-[34%] sm:translate-x-0"
              style={{
                transform: `${phoneTransform}`,
                animation: "landingV2DeviceFloat 7s ease-in-out infinite",
                animationDelay: "1.2s",
              }}
            >
              <Phone3D />
            </div>

            {/* hard ground shadow */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 bottom-[-6px] h-8 rounded-[50%] bg-black/80 blur-2xl"
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes landingV2HeroEntrance {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landingV2DeviceFloat {
          0%, 100% { transform: translate3d(var(--tx, 0), 0, 0); }
          50% { transform: translate3d(var(--tx, 0), -6px, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="landingV2HeroEntrance"],
          [style*="landingV2DeviceFloat"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function heroEntrance(delayMs: number): React.CSSProperties {
  return {
    animation: "landingV2HeroEntrance 700ms ease-out both",
    animationDelay: `${delayMs}ms`,
  };
}

/* ---------- Laptop ---------- */

function Laptop3D() {
  return (
    <div
      className="relative"
      style={{ transform: "perspective(1600px) rotateX(6deg)", transformOrigin: "center bottom" }}
    >
      {/* lid */}
      <div className="relative rounded-t-[14px] bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 p-[5px] shadow-[0_28px_60px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] sm:rounded-t-[18px] sm:p-[7px]">
        {/* camera */}
        <div className="mx-auto mb-[3px] flex h-1.5 items-center justify-center sm:mb-1.5">
          <span className="h-1 w-1 rounded-full bg-zinc-600 shadow-[inset_0_0_2px_rgba(255,255,255,0.25)]" />
        </div>
        {/* screen */}
        <div className="relative overflow-hidden rounded-[10px] bg-[rgb(5_9_20)] ring-1 ring-white/5 sm:rounded-[12px]">
          {/* screen top reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.04] to-transparent"
          />
          {/* browser chrome */}
          <div className="flex items-center gap-1.5 border-b border-white/5 px-2.5 py-1.5 sm:gap-2 sm:px-3.5 sm:py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500/70 sm:h-2 sm:w-2" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70 sm:h-2 sm:w-2" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70 sm:h-2 sm:w-2" />
            <div className="ml-2 hidden min-w-0 flex-1 rounded-[4px] bg-white/[0.04] px-2 py-0.5 text-center text-[9px] text-muted-foreground/55 sm:block sm:text-[10px]">
              app.assetly.co
            </div>
          </div>
          {/* app body */}
          <div className="flex min-h-[180px] sm:min-h-[260px]">
            {/* sidebar */}
            <aside className="hidden w-[82px] shrink-0 flex-col gap-2 border-r border-white/5 p-2 sm:flex sm:w-[104px] sm:gap-2.5 sm:p-3">
              <div className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-gradient-to-br from-primary/50 to-accent/30">
                  <span className="h-1.5 w-1.5 rounded-[1px] bg-foreground/85" />
                </span>
                <span className="text-[9px] font-semibold tracking-tight text-foreground/90 sm:text-[10px]">
                  Assetly
                </span>
              </div>
              <nav className="flex flex-col gap-[3px]">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const active = Boolean(item.active);
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-1.5 rounded-[4px] px-1.5 py-[3px] text-[9px] sm:text-[10px] ${
                        active ? "bg-white/[0.06] text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      <Icon
                        className={`h-2.5 w-2.5 ${active ? "text-primary/85" : "text-muted-foreground/40"}`}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </nav>
            </aside>

            {/* main */}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-4">
              {/* notification */}
              <div className="flex items-center gap-1.5 rounded-md bg-amber-400/[0.09] px-2 py-1 sm:gap-2 sm:px-2.5 sm:py-1.5">
                <Bell className="h-2.5 w-2.5 text-amber-300/80 sm:h-3 sm:w-3" strokeWidth={2} />
                <span className="truncate text-[9px] font-medium text-amber-100/90 sm:text-[10.5px]">
                  Klima — 3 gün içinde bakım gerekli
                </span>
              </div>
              {/* header */}
              <div className="flex items-baseline justify-between">
                <h3 className="text-[11px] font-semibold text-foreground sm:text-[13px]">
                  Varlıklarım
                </h3>
                <span className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground/40 sm:text-[9px]">
                  Durum
                </span>
              </div>
              {/* list */}
              <ul className="flex flex-col divide-y divide-white/[0.04]">
                {laptopAssets.map((asset) => {
                  const Icon = asset.icon;
                  const tone = statusTone[asset.status];
                  return (
                    <li
                      key={asset.label}
                      className={`flex items-center gap-2 py-1.5 sm:gap-2.5 sm:py-2 ${
                        asset.highlight ? "-mx-1.5 rounded-md bg-amber-400/[0.05] px-1.5" : ""
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.04] sm:h-6 sm:w-6 ${
                          asset.highlight ? "text-amber-200/90" : "text-muted-foreground/70"
                        }`}
                      >
                        <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9.5px] font-medium text-foreground sm:text-[11px]">
                          {asset.label}
                        </p>
                        <p className="truncate text-[8.5px] text-muted-foreground/55 sm:text-[10px]">
                          {asset.meta}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-[1px] text-[8.5px] font-medium sm:text-[9.5px] ${tone.pill}`}
                      >
                        <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
                        {tone.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* base / hinge */}
      <div
        aria-hidden
        className="relative mx-auto h-2 w-[104%] -translate-x-[2%] rounded-b-[14px] bg-gradient-to-b from-zinc-700 via-zinc-900 to-black shadow-[0_10px_18px_-8px_rgba(0,0,0,0.8)] sm:h-2.5 sm:rounded-b-[18px]"
      >
        <span className="absolute left-1/2 top-0 h-[2px] w-12 -translate-x-1/2 rounded-b-md bg-black/70 sm:w-16" />
      </div>
    </div>
  );
}

/* ---------- Phone ---------- */

function Phone3D() {
  return (
    <div
      className="relative"
      style={{ transform: "perspective(1200px) rotateY(-4deg) rotateX(2deg)", transformOrigin: "center" }}
    >
      {/* shadow under phone */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 -bottom-3 h-6 rounded-[50%] bg-black/70 blur-xl"
      />

      <div className="relative w-full rounded-[1.75rem] bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 p-[3px] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.05)_inset]">
        <div className="relative overflow-hidden rounded-[1.55rem] bg-[rgb(5_9_20)] ring-1 ring-white/[0.04]">
          {/* notch */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1.5 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-black sm:h-4 sm:w-16"
          />
          {/* top reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/[0.05] to-transparent"
          />

          {/* status bar */}
          <div className="flex items-center justify-between px-3 pt-1.5 text-[7.5px] text-muted-foreground/70 sm:px-4 sm:pt-2 sm:text-[8.5px]">
            <span className="font-medium">09:41</span>
            <div className="flex items-center gap-[2px] opacity-70">
              <span className="h-[2px] w-[2px] rounded-full bg-muted-foreground" />
              <span className="h-[2px] w-[2px] rounded-full bg-muted-foreground" />
              <span className="h-[2px] w-[2px] rounded-full bg-muted-foreground" />
            </div>
          </div>

          {/* screen */}
          <div className="flex flex-col gap-2 px-3 pb-3 pt-4 sm:gap-2.5 sm:px-4 sm:pb-4 sm:pt-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/[0.1] text-amber-200/90 ring-1 ring-amber-400/20 sm:h-8 sm:w-8">
                <Snowflake className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-[7.5px] uppercase tracking-[0.18em] text-muted-foreground/55 sm:text-[8.5px]">
                  Varlık
                </p>
                <h4 className="truncate text-[11px] font-semibold text-foreground sm:text-[13px]">
                  Klima
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-md bg-amber-400/[0.1] px-2 py-1 sm:px-2.5 sm:py-1.5">
              <span className="h-1 w-1 rounded-full bg-amber-300/80" />
              <span className="truncate text-[8.5px] font-medium text-amber-100/90 sm:text-[10px]">
                3 gün içinde bakım gerekli
              </span>
            </div>

            <dl className="flex flex-col gap-1 text-[9px] sm:gap-1.5 sm:text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground/55">Durum</dt>
                <dd className="inline-flex items-center gap-1 text-amber-200/90">
                  <span className="h-1 w-1 rounded-full bg-amber-300/80" />
                  Dikkat
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground/55">Son bakım</dt>
                <dd className="text-foreground/85">6 ay önce</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground/55">Not</dt>
                <dd className="truncate text-foreground/80">Filtre temizliği</dd>
              </div>
            </dl>

            <div className="mt-0.5 w-full rounded-lg bg-gradient-to-b from-primary to-primary/85 py-1.5 text-center text-[9.5px] font-semibold text-primary-foreground shadow-[0_6px_14px_-6px_rgba(59,130,246,0.55)] sm:py-2 sm:text-[11px]">
              Bakımı planla
            </div>
          </div>

          {/* gesture bar */}
          <div className="flex items-center justify-center pb-1 sm:pb-1.5">
            <span className="h-[2.5px] w-14 rounded-full bg-white/25 sm:w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
