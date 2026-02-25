"use client";

import { useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInView } from "@/modules/landing-v2/hooks/use-in-view";
import {
  previewMenuItems,
  previewThemeVars,
  rowDataByMenu,
} from "@/modules/landing-v2/components/panel-preview/constants";
import type { PreviewMenuKey } from "@/modules/landing-v2/components/panel-preview/types";
import { panelPreviewViews } from "@/modules/landing-v2/components/panel-preview/views";

export function DashboardPreview() {
  const { ref, inView } = useInView(0.1);
  const [activeMenu, setActiveMenu] = useState<PreviewMenuKey>("dashboard");
  const menuItems = useMemo(() => previewMenuItems, []);
  const viewByMenu = useMemo(() => panelPreviewViews, []);

  const activeItem = useMemo(
    () => menuItems.find((item) => item.key === activeMenu) ?? menuItems[0],
    [activeMenu, menuItems],
  );

  const ActiveView = viewByMenu[activeMenu];
  const rows = activeMenu === "dashboard" ? [] : rowDataByMenu[activeMenu];

  return (
    <section id="panel" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">Premium Kontrol Paneli</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Güçlü kontrol paneli, <span className="text-gradient">tek bakışta</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Bildirimler, Abonelikler, Fatura Takip ve Skor Analizi dahil tüm modüller tek panelde
          </p>
        </div>

        <div className={cn(inView ? "animate-slide-up" : "opacity-0")}>
          <div className="overflow-hidden rounded-[28px] bg-[rgb(7_14_32_/_66%)] shadow-[0_24px_70px_rgb(5_10_24_/_56%),inset_0_1px_0_rgb(255_255_255_/_0.05),inset_0_0_42px_rgb(16_239_181_/_0.04)]">
            <div
              className="flex h-[560px] max-h-[72vh] min-h-[500px] flex-col md:h-[640px] md:min-h-[560px] md:flex-row"
              style={previewThemeVars}
            >
              <aside className="auth-shell-sidebar hidden w-[var(--auth-sidebar-width)] shrink-0 border-r border-[var(--auth-border)] p-4 md:flex md:flex-col">
                <div className="mb-6 flex-none">
                  <div className="auth-shell-brand flex items-center gap-3 rounded-xl px-2 py-2">
                    <span className="auth-brand-mark flex h-9 w-9 items-center justify-center rounded-xl">
                      <Shield className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold tracking-tight text-[var(--auth-foreground)]">ASSETCARE</p>
                      <p className="text-[9px] text-[var(--auth-muted)]">Premium Kontrol Paneli</p>
                    </div>
                  </div>
                </div>

                <nav aria-label="Ana menü" className="auth-nav-list min-h-0 flex-1 overflow-y-auto pr-1 hide-scrollbar">
                  {menuItems.map((item) => {
                    const isActive = activeMenu === item.key;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveMenu(item.key)}
                        aria-current={isActive ? "page" : undefined}
                        data-state={isActive ? "active" : "inactive"}
                        className="auth-nav-item auth-focus-ring flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2 text-sm"
                      >
                        <span className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
                          <Icon className="auth-nav-icon h-4 w-4" />
                          <span className="truncate font-medium">{item.label}</span>
                        </span>
                        <span className="auth-nav-short-badge relative z-10">{item.badge}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>

              <div className="auth-shell-sidebar flex items-center gap-2 overflow-x-auto border-b border-[var(--auth-border)] px-4 py-3 md:hidden hide-scrollbar">
                {menuItems.map((item) => {
                  const isActive = activeMenu === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveMenu(item.key)}
                      aria-current={isActive ? "page" : undefined}
                      data-state={isActive ? "active" : "inactive"}
                      className="auth-shell-chip auth-focus-ring inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    >
                      <span>{item.label}</span>
                      <span className="auth-nav-short-badge">{item.badge}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-[rgb(10_17_40_/_58%)]">
                {activeMenu === "dashboard" ? null : (
                  <header className="border-b border-[var(--auth-border-soft)] px-5 py-4">
                    <div className="mb-1 inline-flex items-center rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] tracking-[0.16em] text-primary">
                      {activeItem.label}
                    </div>
                    <h3 className="text-base font-semibold text-[var(--auth-foreground)]">{activeItem.title}</h3>
                    <p className="text-xs text-[var(--auth-muted)]">{activeItem.subtitle}</p>
                  </header>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 hide-scrollbar">
                  <ActiveView rows={rows} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
