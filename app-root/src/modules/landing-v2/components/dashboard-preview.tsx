"use client";

import { useMemo, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
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
  const topbarTitle = activeMenu === "dashboard" ? activeItem.title : activeItem.label;
  const topbarBreadcrumb = `Panel / ${activeItem.label}`;

  return (
    <section id="panel" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Kontrol Paneli
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Güçlü kontrol paneli, <span className="text-gradient">tek bakışta</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Bildirimler, Abonelikler, Fatura Takip ve Skor Analizi dahil tüm modüller tek panelde
          </p>
        </div>

        <div className={cn(inView ? "animate-slide-up" : "opacity-0")}>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-[rgb(7_14_32_/_72%)] shadow-[0_20px_60px_-20px_rgba(2,8,20,0.6)]">
            <div
              className="auth-shell-theme flex h-[560px] max-h-[72vh] min-h-[500px] flex-col md:h-[640px] md:min-h-[560px] md:flex-row"
              style={previewThemeVars}
            >
              <aside className="auth-shell-sidebar hidden w-[var(--auth-sidebar-width)] shrink-0 overflow-hidden p-4 md:flex md:flex-col">
                <div className="mb-6 flex-none">
                  <div className="auth-shell-brand flex items-center gap-3 rounded-2xl border-[#2F4569] bg-[linear-gradient(145deg,rgba(10,17,40,0.92),rgba(9,18,34,0.82))] px-3 py-3 shadow-[0_18px_34px_rgba(2,8,20,0.34)]">
                    <span className="auth-brand-mark flex h-11 w-11 items-center justify-center rounded-2xl border-[#36547B] bg-[linear-gradient(160deg,rgba(16,239,181,0.16),rgba(44,247,255,0.18))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_22px_rgba(5,10,24,0.35)]">
                      <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[11px] font-semibold tracking-[0.28em] text-[var(--auth-foreground)]">
                          ASSETLY
                        </p>
                        <span className="inline-flex shrink-0 rounded-full border border-[#355071] bg-[rgba(16,239,181,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--auth-primary)]">
                          Premium
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[10px] uppercase tracking-[0.18em] text-[#8FA6C7]">
                        Operasyon paneli
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative mt-3 flex min-h-0 flex-1">
                  <div className="hide-scrollbar flex-1 min-h-0 overflow-y-auto pb-2 pr-1 overscroll-contain">
                    <nav aria-label="Ana menü" className="auth-nav-list">
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
                            <span className="auth-nav-meta relative z-10">
                              <span className="auth-nav-short-badge">{item.badge}</span>
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>

                  <div className="pointer-events-none absolute left-0 right-0 top-0 h-6 bg-gradient-to-b from-background/80 to-transparent" />
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
              </aside>

              <div className="flex min-h-0 flex-1 flex-col bg-[rgb(10_17_40_/_58%)]">
                <header className="auth-shell-topbar h-16 shrink-0">
                  <div className="auth-topbar-inner flex h-full items-center justify-between gap-3 px-4 sm:px-5">
                    <div className="min-w-0">
                      <p className="auth-topbar-breadcrumb truncate text-[11px]">{topbarBreadcrumb}</p>
                      <h3 className="truncate text-sm font-semibold text-[var(--auth-foreground)] sm:text-base">
                        {topbarTitle}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Bildirimler"
                        className="auth-topbar-control auth-focus-ring relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
                      >
                        <Bell className="h-4 w-4" />
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--auth-primary)]" />
                      </button>

                      <span className="auth-topbar-separator" aria-hidden />

                      <button
                        type="button"
                        aria-label="Kullanıcı menüsü"
                        className="auth-topbar-control auth-focus-ring inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[var(--auth-foreground)]"
                      >
                        <span className="auth-topbar-avatar inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                          A
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--auth-muted)]" />
                      </button>
                    </div>
                  </div>
                </header>

                <main className="auth-shell-main flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-5">
                  <nav aria-label="Mobil menü" className="auth-mobile-nav mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
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
                  </nav>

                  {activeMenu === "dashboard" ? null : (
                    <section className="auth-shell-card auth-shell-intro mb-5 rounded-2xl p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="auth-section-chip">{activeItem.label}</span>
                            <span className="inline-flex rounded-full border border-[#345073] bg-[#102643] px-2.5 py-1 text-xs font-semibold text-[#C3D7F4]">
                              {activeItem.badge}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-[var(--auth-foreground)]">{activeItem.title}</h3>
                            <p className="mt-1 text-xs text-[var(--auth-muted)]">{activeItem.subtitle}</p>
                          </div>
                        </div>
                        <span className="inline-flex h-fit rounded-full border border-[#29425F] bg-[#0B1730]/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8FA6C7]">
                          Demo görünüm
                        </span>
                      </div>
                    </section>
                  )}

                  <div className="auth-shell-content min-h-0 flex-1">
                    <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
                      <ActiveView rows={rows} menuItem={activeItem} />
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
