"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { ComponentType } from "react";

type DeviceTab = "web" | "mobile";

interface Tab {
  key: DeviceTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { key: "web", label: "Masaüstü", icon: Monitor },
  { key: "mobile", label: "Mobil", icon: Smartphone },
];

export default function DeviceExperienceSection() {
  const [active, setActive] = useState<DeviceTab>("web");
  const [visible, setVisible] = useState(true);

  function switchTab(next: DeviceTab) {
    if (next === active) return;
    setVisible(false);
    setTimeout(() => {
      setActive(next);
      setVisible(true);
    }, 120);
  }

  const isMobile = active === "mobile";

  return (
    <section id="panel" className="relative isolate py-20 sm:py-28 lg:py-32">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Tek Platform
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Her cihazda{" "}
            <span className="text-gradient">aynı deneyim</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
            Masaüstünde açtığınız panel, telefonunuzda da aynı şekilde görünür.
          </p>
        </div>

        {/* Tab toggle */}
        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => switchTab(tab.key)}
                  className={`
                    inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Device frame */}
        <div className="flex justify-center">
          <div
            className={`
              relative overflow-hidden rounded-2xl border border-border
              bg-card/70 shadow-[0_20px_60px_-20px_rgba(2,8,20,0.6)]
              transition-all duration-300 ease-out
              ${isMobile ? "w-full max-w-[360px]" : "w-full max-w-3xl"}
            `}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-border bg-secondary/40 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/50" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/50" />
              <span className="ml-3 flex-1 rounded-md bg-background/50 px-3 py-1 text-[11px] text-muted-foreground">
                app.assetly.io/dashboard
              </span>
              {/* Inline sync indicator */}
              <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Senkron
              </span>
            </div>

            {/* Content — single cohesive flow */}
            <div
              className="p-5 sm:p-6"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible
                  ? "translateY(0) scale(1)"
                  : "translateY(6px) scale(0.98)",
                transition: "opacity 220ms ease-out, transform 220ms ease-out",
              }}
            >
              {/* 1. Notification — top */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
                    Bakım Hatırlatma
                  </p>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    3 gün kaldı
                  </span>
                </div>
                <p className="mt-2.5 text-sm font-medium text-foreground">
                  Klima periyodik bakım tarihi yaklaşıyor
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Son servis: 14 Ocak 2026 · Periyot: 6 ay
                  </p>
                  <span className="shrink-0 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    Bakımı planla
                  </span>
                </div>
              </div>

              {/* 2. Main metric — center */}
              <div className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.04] p-5">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Varlık Durumu
                  </p>
                  <p className="mt-2 text-5xl font-bold tracking-tighter text-foreground sm:text-6xl">
                    48
                  </p>
                </div>
                <div className="mx-auto my-4 h-px w-16 bg-border/40" />
                <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-400">42</p>
                    <p className="text-[10px] text-muted-foreground">Güncel</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-400">4</p>
                    <p className="text-[10px] text-muted-foreground">Dikkat</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-destructive/80">2</p>
                    <p className="text-[10px] text-muted-foreground">Gecikmiş</p>
                  </div>
                </div>
                <p className="mx-auto mt-3 text-center text-[10px] text-muted-foreground/60">
                  Bakım veya garanti tarihi yaklaşan varlıklar
                </p>
                <div className="mx-auto mt-2 flex justify-center">
                  <span className="rounded-md bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                    Varlık listesini aç
                  </span>
                </div>
              </div>

              {/* 3. Compact status row — bottom */}
              <div className={`mt-4 grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
                <StatusChip label="Abonelik" value="Aktif" variant="primary" />
                <StatusChip label="Son Fatura" value="Ödendi" variant="success" />
                <StatusChip label="Garanti" value="2 yaklaşıyor" variant="warning" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Primitives ────────────────────────────────────── */

function StatusChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "primary" | "success" | "warning";
}) {
  const colors = {
    primary: "border-primary/20 text-primary",
    success: "border-emerald-500/20 text-emerald-400",
    warning: "border-amber-500/20 text-amber-400",
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/20 px-3.5 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-semibold ${colors[variant]}`}>
        {value}
      </p>
    </div>
  );
}
