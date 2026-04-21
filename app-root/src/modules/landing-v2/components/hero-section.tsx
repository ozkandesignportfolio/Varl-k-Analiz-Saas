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
      {/* Background: clean gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-[#0B1220] to-[#0E1A2B]"
      />
      {/* Soft radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[35%] -z-10 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(14,165,164,0.08)_0%,transparent_65%)] blur-[80px]"
      />

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
          className="max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
          style={heroEntrance(80)}
        >
          <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 bg-clip-text text-transparent">
            Varlıklarını tek yerde topla,
          </span>{" "}
          <span className="text-foreground">kontrolü kaybetme.</span>
        </h1>

        {/* Description */}
        <p
          className="max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg"
          style={heroEntrance(160)}
        >
          Cihazlarını, aboneliklerini ve bakım süreçlerini tek panelde topla.
          Yaklaşan işlemler için hatırlatmalar al, servis kayıtlarını ve belgelerini
          düzenli tut, tüm maliyetlerini tek ekranda takip et.
        </p>

        {/* Trust line */}
        <p
          className="text-sm text-gray-400"
          style={heroEntrance(240)}
        >
          Kurulum gerektirmez · Dakikalar içinde hazır · Ücretsiz plan mevcut
        </p>

        {/* Platform icon row */}
        <div
          className="mt-8 flex flex-wrap justify-center gap-6"
          style={heroEntrance(320)}
        >
          {platformCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white/20 hover:bg-white/[0.07]"
              >
                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg">
                  <Icon className="h-5 w-5 text-white" strokeWidth={1.8} />
                </div>
                <span className="text-sm font-medium text-white">{card.label}</span>
                <span className="px-2 text-center text-xs text-gray-400">{card.sub}</span>
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
