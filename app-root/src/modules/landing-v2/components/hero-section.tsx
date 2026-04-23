"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Colorful brand icons ── */

function WebIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="h-8 w-8">
      <defs>
        <linearGradient id="webG1" x1="8" y1="4" x2="40" y2="36">
          <stop stopColor="#1e7ab5" />
          <stop offset="1" stopColor="#0d4f7a" />
        </linearGradient>
        <linearGradient id="webG2" x1="8" y1="36" x2="40" y2="44">
          <stop stopColor="#0d4f7a" />
          <stop offset="1" stopColor="#1e7ab5" />
        </linearGradient>
      </defs>
      {/* Globe */}
      <circle cx="24" cy="19" r="15" stroke="url(#webG1)" strokeWidth={2.8} />
      <ellipse cx="24" cy="19" rx="8" ry="15" stroke="url(#webG1)" strokeWidth={2} />
      <path d="M9 19h30" stroke="url(#webG1)" strokeWidth={2} />
      <path d="M11 11h26" stroke="url(#webG1)" strokeWidth={1.4} />
      <path d="M11 27h26" stroke="url(#webG1)" strokeWidth={1.4} />
      <path d="M24 4v30" stroke="url(#webG1)" strokeWidth={1.4} />
      {/* WWW pill */}
      <rect x="8" y="37" width="32" height="9" rx="4.5" fill="url(#webG2)" />
      <text x="24" y="43.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="800" fontFamily="system-ui,sans-serif" letterSpacing="0.5">WWW</text>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8">
      <defs>
        <linearGradient id="appleGrad" x1="6" y1="2" x2="18" y2="22">
          <stop stopColor="#f0f0f0" />
          <stop offset="1" stopColor="#a0a0a0" />
        </linearGradient>
      </defs>
      <path
        fill="url(#appleGrad)"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-8 w-8">
      <defs>
        <linearGradient id="aG1" x1="14" y1="6" x2="34" y2="44">
          <stop stopColor="#a4c639" />
          <stop offset="0.5" stopColor="#8ab530" />
          <stop offset="1" stopColor="#6a9a23" />
        </linearGradient>
      </defs>
      {/* Antennae */}
      <line x1="17" y1="5" x2="20" y2="11" stroke="url(#aG1)" strokeWidth={2} strokeLinecap="round" />
      <line x1="31" y1="5" x2="28" y2="11" stroke="url(#aG1)" strokeWidth={2} strokeLinecap="round" />
      {/* Head */}
      <path d="M12 20a12 12 0 0 1 24 0v1H12v-1z" fill="url(#aG1)" />
      {/* Eyes */}
      <circle cx="19" cy="16" r="1.5" fill="white" />
      <circle cx="29" cy="16" r="1.5" fill="white" />
      {/* Body */}
      <rect x="12" y="22" width="24" height="14" rx="3" fill="url(#aG1)" />
      {/* Arms */}
      <rect x="5" y="23" width="5" height="11" rx="2.5" fill="url(#aG1)" />
      <rect x="38" y="23" width="5" height="11" rx="2.5" fill="url(#aG1)" />
      {/* Legs */}
      <rect x="16" y="36" width="5" height="8" rx="2.5" fill="url(#aG1)" />
      <rect x="27" y="36" width="5" height="8" rx="2.5" fill="url(#aG1)" />
    </svg>
  );
}

type PlatformCard = {
  icon: () => ReactNode;
  label: string;
  sub: string;
  iconBg: string;
  shadow: string;
};

const platformCards: PlatformCard[] = [
  {
    icon: WebIcon,
    label: "Web",
    sub: "Tüm tarayıcılarla uyumlu",
    iconBg: "bg-sky-500/15 ring-sky-400/20",
    shadow: "shadow-[0_6px_20px_-6px_rgba(56,189,248,0.4)]",
  },
  {
    icon: AppleIcon,
    label: "iOS",
    sub: "iPhone ve iPad ile uyumlu",
    iconBg: "bg-white/10 ring-white/15",
    shadow: "shadow-[0_6px_20px_-6px_rgba(200,200,200,0.25)]",
  },
  {
    icon: AndroidIcon,
    label: "Android",
    sub: "Tüm Android cihazlarla uyumlu",
    iconBg: "bg-emerald-500/15 ring-emerald-400/20",
    shadow: "shadow-[0_6px_20px_-6px_rgba(61,220,132,0.4)]",
  },
];

export function HeroSection() {
  return (
    <section className="relative isolate overflow-x-clip pb-24 pt-28 sm:pb-28 sm:pt-32 lg:pb-32 lg:pt-40">
      {/* Subtle top glow — blends with page bg (#050a18) + AnimatedBackground */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[20%] -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(16,239,181,0.06)_0%,rgba(44,247,255,0.03)_40%,transparent_70%)] blur-[80px]"
      />

      {/* Animated background blobs — CSS-only, low opacity + blur for perf */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-blob absolute -left-20 top-[10%] h-72 w-72 rounded-full bg-emerald-500/[0.12] blur-3xl" />
        <div className="animate-blob-slow absolute -right-16 top-[20%] h-80 w-80 rounded-full bg-indigo-500/[0.10] blur-3xl" style={{ animationDelay: "-4s" }} />
        <div className="animate-blob absolute bottom-[5%] left-[30%] h-64 w-64 rounded-full bg-purple-500/[0.10] blur-3xl" style={{ animationDelay: "-8s" }} />
        <div className="animate-float-slow absolute right-[15%] top-[5%] h-56 w-56 rounded-full bg-cyan-400/[0.08] blur-3xl" style={{ animationDelay: "-2s" }} />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 text-center">
        {/* Pill badge */}
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

        {/* Headline */}
        <h1
          className="max-w-3xl text-balance text-3xl font-bold leading-[1.1] tracking-tight md:text-5xl"
          style={heroEntrance(80)}
        >
          <span className="text-white">Tüm varlıklarını </span>
          <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">tek panelde</span>
          <span className="text-white"> yönet</span>
        </h1>

        {/* Description */}
        <p
          className="max-w-2xl text-gray-400 leading-relaxed md:text-lg"
          style={heroEntrance(160)}
        >
          Cihazlarını, aboneliklerini ve bakım süreçlerini tek merkezde topla<br />
          Maliyetlerini{" "}
          <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">anlık takip</span>
          {" "}et, hatırlatmalarla hiçbir detayı kaçırma
        </p>

        {/* Trust line */}
        <p
          className="text-sm text-muted-foreground/70"
          style={heroEntrance(240)}
        >
          Kurulum gerektirmez · Dakikalar içinde hazır · Ücretsiz plan mevcut
        </p>

        {/* CTA buttons */}
        <div
          className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          style={heroEntrance(300)}
        >
          <Button
            asChild
            size="lg"
            className="group h-12 w-full bg-primary px-8 text-[15px] font-semibold text-primary-foreground shadow-[0_12px_32px_-8px_rgba(16,239,181,0.4)] hover:bg-primary/90 sm:w-auto"
          >
            <Link href="/register">
              Ücretsiz Kayıt Ol
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 w-full border-white/15 bg-white/[0.03] px-8 text-[15px] font-medium text-foreground backdrop-blur-sm hover:border-white/25 hover:bg-white/[0.06] sm:w-auto"
          >
            <Link href="#ozellikler">Özellikleri Keşfet</Link>
          </Button>
        </div>

        {/* Platform icon row */}
        <div
          className="mt-6 grid w-full max-w-md grid-cols-3 gap-3 sm:mt-8 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-6"
          style={heroEntrance(380)}
        >
          {platformCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-5 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white/[0.15] hover:bg-white/[0.06] sm:h-44 sm:w-44 sm:gap-2.5 sm:px-0 sm:py-0"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 sm:mb-1 sm:h-14 sm:w-14 ${card.iconBg} ${card.shadow}`}>
                  <Icon />
                </div>
                <span className="text-xs font-semibold text-foreground sm:text-sm">{card.label}</span>
                <span className="hidden px-3 text-center text-[11px] leading-snug text-muted-foreground sm:block">{card.sub}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes landingV2HeroEntrance {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="landingV2HeroEntrance"] {
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
