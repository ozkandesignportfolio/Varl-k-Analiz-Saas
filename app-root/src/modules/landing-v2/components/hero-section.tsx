"use client";

import { Monitor, Smartphone } from "lucide-react";

const platformCards = [
  { icon: Monitor, label: "Web", sub: "Her yerden eriş" },
  { icon: Smartphone, label: "iOS", sub: "Hareket halindeyken kontrol" },
  { icon: Smartphone, label: "Android", sub: "Anlık takip ve uyarı" },
];

export function HeroSection() {
  return (
    <section className="relative isolate overflow-x-clip pb-24 pt-28 sm:pb-28 sm:pt-32 lg:pb-32 lg:pt-40">
      {/* Base: deep navy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[#0B1220]"
      />
      {/* Animated radial glow */}
      <div
        aria-hidden
        className="hero-glow-pulse pointer-events-none absolute left-1/2 top-[32%] -z-10 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.1)_0%,rgba(6,182,212,0.06)_35%,transparent_70%)] blur-[100px]"
      />
      {/* Secondary warm glow */}
      <div
        aria-hidden
        className="hero-glow-pulse pointer-events-none absolute left-[60%] top-[50%] -z-10 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_70%)] blur-[120px]"
        style={{ animationDelay: "2s" }}
      />
      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:3px_3px]"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-5 text-center sm:px-6">
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
          className="mt-6 text-balance text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl"
          style={heroEntrance(80)}
        >
          <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-transparent">
            Varlıklarını tek yerde topla,
          </span>{" "}
          <span className="text-foreground">kontrolü kaybetme.</span>
        </h1>

        {/* Description */}
        <p
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-300 sm:mt-6 sm:text-lg"
          style={heroEntrance(160)}
        >
          Cihazlarını, aboneliklerini ve bakım süreçlerini tek panelde topla.
          Yaklaşan işlemler için hatırlatmalar al, servis kayıtlarını ve belgelerini
          düzenli tut, tüm maliyetlerini tek ekranda takip et.
        </p>

        {/* Trust line */}
        <p
          className="mt-5 text-sm text-gray-400 sm:mt-6"
          style={heroEntrance(240)}
        >
          Kurulum gerektirmez · Dakikalar içinde hazır · Ücretsiz plan mevcut
        </p>

        {/* Platform icon row */}
        <div
          className="mx-auto mt-12 grid max-w-sm grid-cols-2 gap-4 sm:mt-14 sm:flex sm:max-w-none sm:items-stretch sm:justify-center sm:gap-5"
          style={heroEntrance(320)}
        >
          {platformCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="hero-badge-float group relative flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-5 shadow-xl backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:border-white/[0.18] hover:bg-white/[0.07]"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                {/* Inner glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.06)_0%,transparent_70%)]"
                />
                {/* Icon */}
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 shadow-[0_4px_16px_-4px_rgba(6,182,212,0.3)] ring-1 ring-white/[0.08]">
                  <Icon className="h-5 w-5 text-cyan-400" strokeWidth={1.8} />
                </div>
                {/* Label */}
                <span className="text-sm font-semibold text-foreground/90">{card.label}</span>
                {/* Sublabel */}
                <span className="text-xs leading-snug text-gray-400">{card.sub}</span>
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
        @keyframes heroBadgeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes heroGlowPulse {
          0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.05); }
        }
        .hero-badge-float {
          animation: heroBadgeFloat 4.5s ease-in-out infinite;
        }
        .hero-glow-pulse {
          animation: heroGlowPulse 8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="landingV2HeroEntrance"],
          .hero-badge-float,
          .hero-glow-pulse {
            animation: none !important;
            opacity: 1 !important;
            transform: translate(-50%, -50%) !important;
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
