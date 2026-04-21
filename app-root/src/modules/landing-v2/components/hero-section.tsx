"use client";

import { Monitor, Smartphone } from "lucide-react";

const platformBadges = [
  { icon: Monitor, label: "Web" },
  { icon: Smartphone, label: "iOS" },
  { icon: Smartphone, label: "Android" },
];

export function HeroSection() {
  return (
    <section className="relative isolate overflow-x-clip pb-24 pt-28 sm:pb-28 sm:pt-32 lg:pb-32 lg:pt-40">
      {/* Background: deep navy → soft teal glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(180deg,#0B1220_0%,#060d1a_100%)]"
      />
      {/* Radial teal glow center */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] -z-10 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(14,165,164,0.07)] blur-[160px]"
      />
      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:3px_3px]"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 text-center sm:px-6">
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
          className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl"
          style={heroEntrance(80)}
        >
          Varlıklarını <span className="text-gradient">merkezi bir sistemle</span> yönet,
          operasyonlarını sadeleştir.
        </h1>

        <p
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg"
          style={heroEntrance(160)}
        >
          Assetly; cihazlarını, aboneliklerini ve bakım süreçlerini tek panelde toplar.
          Kritik uyarıları kaçırmadan tüm varlıklarını kontrol altında tutmanı sağlar.
        </p>

        <p
          className="mt-5 text-xs text-muted-foreground/70 sm:mt-6 sm:text-[13px]"
          style={heroEntrance(240)}
        >
          Kurulum gerektirmez · Dakikalar içinde hazır · Ücretsiz plan mevcut
        </p>

        {/* Platform icon row */}
        <div
          className="mx-auto mt-12 grid max-w-xs grid-cols-2 gap-4 sm:mt-14 sm:flex sm:max-w-none sm:items-center sm:justify-center sm:gap-6"
          style={heroEntrance(320)}
        >
          {platformBadges.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className="hero-badge-float group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.4)] backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:border-white/[0.14] hover:bg-white/[0.05]"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/[0.08]">
                  <Icon className="h-4 w-4 text-primary/80" strokeWidth={1.8} />
                </div>
                <span className="text-sm font-medium text-foreground/85">{badge.label}</span>
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
          50% { transform: translateY(-4px); }
        }
        .hero-badge-float {
          animation: heroBadgeFloat 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="landingV2HeroEntrance"],
          .hero-badge-float {
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
