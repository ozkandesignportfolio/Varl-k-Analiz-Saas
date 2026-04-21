"use client";

import type { ReactNode } from "react";

/* ── Colorful brand icons ── */

function WebIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
      <circle cx="12" cy="12" r="10" stroke="url(#webGrad)" strokeWidth={1.6} />
      <path d="M2 12h20" stroke="url(#webGrad)" strokeWidth={1.4} />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="url(#webGrad)" strokeWidth={1.4} />
      <defs>
        <linearGradient id="webGrad" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7">
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
    <svg viewBox="0 0 24 24" className="h-7 w-7">
      <defs>
        <linearGradient id="androidGrad" x1="6" y1="2" x2="18" y2="22">
          <stop stopColor="#69f0ae" />
          <stop offset="1" stopColor="#3ddc84" />
        </linearGradient>
      </defs>
      <path fill="url(#androidGrad)" d="M17.523 15.341a1 1 0 0 0 1-1v-5.5a1 1 0 0 0-2 0v5.5a1 1 0 0 0 1 1zm-11.046 0a1 1 0 0 0 1-1v-5.5a1 1 0 0 0-2 0v5.5a1 1 0 0 0 1 1z" />
      <path fill="url(#androidGrad)" d="M14.96 3.66l1.3-1.3a.5.5 0 0 0-.71-.71l-1.49 1.49A5.62 5.62 0 0 0 12 2.71a5.62 5.62 0 0 0-2.06.43L8.45 1.65a.5.5 0 0 0-.71.71l1.3 1.3A4.94 4.94 0 0 0 7 7.71v.79h10v-.79a4.94 4.94 0 0 0-2.04-4.05zM10 6.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm4 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
      <path fill="url(#androidGrad)" d="M7 8.5h10v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7z" />
      <path fill="url(#androidGrad)" d="M9 19.5v2a1 1 0 0 0 2 0v-2h2v2a1 1 0 0 0 2 0v-2" />
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
          className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          style={heroEntrance(160)}
        >
          Cihazlarını, aboneliklerini ve bakım süreçlerini tek panelde topla.
          Yaklaşan işlemler için hatırlatmalar al, servis kayıtlarını ve belgelerini
          düzenli tut, tüm maliyetlerini tek ekranda takip et.
        </p>

        {/* Trust line */}
        <p
          className="text-sm text-muted-foreground/70"
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
                className="flex h-44 w-44 flex-col items-center justify-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white/[0.15] hover:bg-white/[0.06]"
              >
                <div className={`mb-1 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${card.iconBg} ${card.shadow}`}>
                  <Icon />
                </div>
                <span className="text-sm font-semibold text-foreground">{card.label}</span>
                <span className="px-3 text-center text-[11px] leading-snug text-muted-foreground">{card.sub}</span>
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
