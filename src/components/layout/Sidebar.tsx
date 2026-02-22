"use client";

import type { ReactNode, WheelEvent } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, ChevronDown, Shield, type LucideIcon } from "lucide-react";
import { usePlanContext } from "@/contexts/PlanContext";
import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon?: LucideIcon;
};

type SidebarProps = {
  items: SidebarNavItem[];
  collapsed?: boolean;
  brand?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onNavigate?: () => void;
};

const ASSETS_NAV_ITEM: SidebarNavItem = {
  href: "/assets",
  label: "Varlıklar",
  shortLabel: "VR",
  icon: Box,
};

const ensureAssetsNavItem = (items: SidebarNavItem[]) => {
  const nonAssetItems = items.filter((item) => item.href !== ASSETS_NAV_ITEM.href);
  const dashboardIndex = nonAssetItems.findIndex((item) => item.href === "/dashboard");
  const insertIndex = dashboardIndex >= 0 ? dashboardIndex + 1 : 0;

  return [
    ...nonAssetItems.slice(0, insertIndex),
    ASSETS_NAV_ITEM,
    ...nonAssetItems.slice(insertIndex),
  ];
};

const PRIMARY_PINNED_HREFS = new Set(["/notifications", "/settings"]);

const getSidebarSections = (items: SidebarNavItem[], collapsed: boolean) => {
  if (collapsed) {
    return { primaryItems: items, secondaryItems: [] as SidebarNavItem[] };
  }

  const initialPrimaryItems = items.slice(0, 8);
  const missingPinnedItems = items.filter(
    (item) =>
      PRIMARY_PINNED_HREFS.has(item.href) &&
      !initialPrimaryItems.some((initialItem) => initialItem.href === item.href),
  );
  const primaryItems = [...initialPrimaryItems, ...missingPinnedItems];
  const primaryItemHrefs = new Set(primaryItems.map((item) => item.href));
  const secondaryItems = items.filter((item) => !primaryItemHrefs.has(item.href));

  return { primaryItems, secondaryItems };
};

const isActivePath = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
};

const getShortLabel = (item: SidebarNavItem) => {
  if (item.shortLabel) {
    return item.shortLabel;
  }

  return item.label.slice(0, 2).toUpperCase();
};

export function Sidebar({ items, collapsed = false, brand, footer, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const {
    plan,
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    subscriptionCount,
    subscriptionLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
  } = usePlanContext();
  const isFreePlan = plan === "free";
  const normalizedItems = useMemo(() => ensureAssetsNavItem(items), [items]);
  const { primaryItems, secondaryItems } = useMemo(
    () => getSidebarSections(normalizedItems, collapsed),
    [collapsed, normalizedItems],
  );
  const hasSecondaryActive = secondaryItems.some((item) => isActivePath(pathname, item.href));

  const usageLimit = assetLimit ?? 3;
  const formatUsage = (count: number, limit: number | null) => `${count}/${limit ?? "∞"}`;
  const usagePercent = useMemo(() => {
    if (!isFreePlan || usageLimit <= 0) {
      return 100;
    }
    const ratios = [
      assetLimit && assetLimit > 0 ? assetCount / assetLimit : 0,
      documentLimit && documentLimit > 0 ? documentCount / documentLimit : 0,
      subscriptionLimit && subscriptionLimit > 0 ? subscriptionCount / subscriptionLimit : 0,
      invoiceUploadLimit && invoiceUploadLimit > 0 ? invoiceUploadCount / invoiceUploadLimit : 0,
    ];
    const highestRatio = Math.max(...ratios);
    return Math.max(0, Math.min(100, Math.round(highestRatio * 100)));
  }, [
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
    isFreePlan,
    subscriptionCount,
    subscriptionLimit,
    usageLimit,
  ]);

  const nextBillingDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }, []);

  const handleBottomSectionWheel = (event: WheelEvent<HTMLDivElement>) => {
    const wrapper = event.currentTarget;
    if (wrapper.scrollHeight > wrapper.clientHeight) {
      event.stopPropagation();
    }
  };

  return (
    <aside className={cn("auth-shell-sidebar ui-pad flex h-full flex-col overflow-hidden", className)}>
      <div className="mb-6 flex-none">
        {brand ?? (
          <Link
            href="/"
            onClick={onNavigate}
            aria-label="AssetCare ana sayfa"
            className={cn(
              "auth-shell-brand auth-focus-ring flex items-center gap-3 rounded-xl px-2 py-2",
              collapsed && "justify-center px-2",
            )}
          >
            <span className="auth-brand-mark flex h-9 w-9 items-center justify-center rounded-xl">
              <Shield className="h-4 w-4" />
            </span>
            {!collapsed ? (
              <div>
                <p className="text-xs font-bold tracking-tight text-[var(--auth-foreground)]">ASSETCARE</p>
                <p className="text-[9px] text-[var(--auth-muted)]">Premium Panel</p>
              </div>
            ) : null}
          </Link>
        )}
      </div>

      <div className="relative mt-3 flex min-h-0 flex-1">
        {/* Scroll container: header dışındaki tüm sidebar içeriği burada kayar. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto hide-scrollbar pb-2 pr-1 overscroll-contain"
          onWheel={handleBottomSectionWheel}
        >
          <div className="flex min-h-full flex-col">
            <nav aria-label="Ana menü" className="auth-nav-list">
              {primaryItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                const shortLabel = getShortLabel(item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    data-state={active ? "active" : "inactive"}
                    className={cn(
                      "auth-nav-item auth-focus-ring flex items-center rounded-lg px-3.5 py-2 text-sm",
                      collapsed ? "justify-center px-3" : "justify-between gap-3",
                    )}
                  >
                    {collapsed ? (
                      Icon ? (
                        <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-md">
                          <Icon className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="auth-nav-short-badge relative z-10 rounded-md px-2 py-0.5 text-[10px] tracking-tight">
                          {shortLabel}
                        </span>
                      )
                    ) : (
                      <>
                        <span className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
                          {Icon ? (
                            <span className="inline-flex items-center justify-center">
                              <Icon className="auth-nav-icon h-4 w-4" />
                            </span>
                          ) : null}
                          <span className="truncate font-medium">{item.label}</span>
                        </span>
                        <span className="auth-nav-meta relative z-10">
                          <span className="auth-nav-short-badge">{shortLabel}</span>
                        </span>
                      </>
                    )}
                  </Link>
                );
              })}
            </nav>

            {!collapsed ? (
              <>
                {secondaryItems.length > 0 ? (
                  <details className="auth-nav-more-group" open={hasSecondaryActive || undefined}>
                    <summary
                      data-state={hasSecondaryActive ? "active" : "inactive"}
                      className="auth-nav-item auth-focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3.5 py-2 text-sm"
                    >
                      <span className="relative z-10 truncate font-medium">Diğer</span>
                      <ChevronDown className="auth-nav-more-icon relative z-10 h-4 w-4" />
                    </summary>
                    <div className="mt-1 flex flex-col gap-1">
                      {secondaryItems.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        const shortLabel = getShortLabel(item);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            data-state={active ? "active" : "inactive"}
                            className="auth-nav-item auth-focus-ring flex items-center justify-between gap-3 rounded-lg px-3.5 py-2 text-sm"
                          >
                            <span className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
                              {Icon ? (
                                <span className="inline-flex items-center justify-center">
                                  <Icon className="auth-nav-icon h-4 w-4" />
                                </span>
                              ) : null}
                              <span className="truncate font-medium">{item.label}</span>
                            </span>
                            <span className="auth-nav-meta relative z-10">
                              <span className="auth-nav-short-badge">{shortLabel}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                ) : null}

                <div className="auth-sidebar-footer mt-3 flex flex-col gap-3 pb-3">
                  {isFreePlan ? (
                    <article className="auth-plan-card auth-plan-card-free rounded-xl p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-100">Deneme Planı</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--auth-foreground)]">
                        Varlıklar: {formatUsage(assetCount, assetLimit)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--auth-muted)]">Belgeler: {formatUsage(documentCount, documentLimit)}</p>
                      <p className="mt-1 text-xs text-[var(--auth-muted)]">
                        Abonelikler: {formatUsage(subscriptionCount, subscriptionLimit)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--auth-muted)]">
                        Fatura Yükleme: {formatUsage(invoiceUploadCount, invoiceUploadLimit)}
                      </p>
                      <div className="auth-plan-progress mt-2 h-2 rounded-full">
                        <div
                          className="auth-plan-progress-fill h-full rounded-full transition-[width] duration-300 ease-out"
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <Link
                        href="/pricing"
                        onClick={onNavigate}
                        className="auth-focus-ring mt-3 inline-flex w-full items-center justify-center rounded-lg border border-amber-300/35 bg-amber-300/18 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/28"
                      >
                        Premium&apos;a Geç
                      </Link>
                    </article>
                  ) : (
                    <article className="auth-plan-card auth-plan-card-premium rounded-xl p-3">
                      <p className="inline-flex items-center rounded-full border border-[rgb(16_239_181_/_0.35)] bg-[rgb(16_239_181_/_0.15)] px-2 py-1 text-xs font-semibold text-[var(--auth-primary)]">
                        Premium Üye
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-sm text-[var(--auth-foreground)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--auth-primary)]" />
                        Sınırsız varlık aktif
                      </p>
                      <p className="mt-2 text-xs text-[var(--auth-muted)]">Sonraki fatura: {nextBillingDate}</p>
                    </article>
                  )}

                  {footer ? <div>{footer}</div> : null}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {!collapsed ? (
          <>
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-6 bg-gradient-to-b from-background/80 to-transparent" />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background/80 to-transparent" />
          </>
        ) : null}
      </div>
    </aside>
  );
}
