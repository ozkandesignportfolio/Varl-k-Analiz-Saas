"use client";

import type { ReactNode } from "react";
import { useContext, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Shield, type LucideIcon } from "lucide-react";
import { PlanContext } from "@/contexts/PlanContext";
import { NAV_TEXT, SIDEBAR_TEXT } from "@/constants/ui-text";
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
  label: NAV_TEXT.assets,
  shortLabel: "VR",
  icon: Box,
};

const SIDEBAR_ORDER_CANDIDATES = [
  ["/dashboard"],
  ["/assets"],
  ["/maintenance"],
  ["/services"],
  ["/documents"],
  ["/timeline"],
  ["/expenses"],
  ["/notifications"],
  ["/billing", "/subscriptions"],
  ["/invoices", "/billing"],
  ["/score", "/analysis", "/costs"],
  ["/reports"],
  ["/settings"],
] as const;

const EXPENSES_LABEL = NAV_TEXT.expenses;
const SIDEBAR_ARIA_LABEL = SIDEBAR_TEXT.ariaLabel;
const FREE_PLAN_LABEL = SIDEBAR_TEXT.freePlanLabel;
const INITIAL_ASSET_LIMIT = 3;
const subscribeToHydration = () => () => {};

const orderSidebarItems = (items: SidebarNavItem[]) => {
  const workingItems = [...items];
  const orderedItems: SidebarNavItem[] = [];

  for (const candidateHrefs of SIDEBAR_ORDER_CANDIDATES) {
    for (let index = 0; index < workingItems.length; index += 1) {
      if ((candidateHrefs as readonly string[]).includes(workingItems[index].href)) {
        orderedItems.push(workingItems[index]);
        workingItems.splice(index, 1);
        break;
      }
    }
  }

  return [...orderedItems, ...workingItems];
};

const isActivePath = (pathname: string, href: string) => {
  return pathname === href || pathname.startsWith(`${href}/`);
};

const getDisplayLabel = (item: SidebarNavItem) => {
  if (item.href === "/expenses") {
    return EXPENSES_LABEL;
  }

  return item.label;
};

const getShortLabel = (item: SidebarNavItem, displayLabel: string) => {
  if (item.shortLabel) {
    return item.shortLabel;
  }

  return displayLabel.slice(0, 2).toLocaleUpperCase("tr-TR");
};

export function Sidebar({ items, collapsed = false, brand, footer, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const showPlanDebug = process.env.NODE_ENV !== "production";
  const planContext = useContext(PlanContext);
  const plan = planContext?.plan ?? "free";
  const userId = planContext?.userId ?? null;
  const assetCount = planContext?.assetCount ?? 0;
  const assetLimit = planContext?.assetLimit ?? INITIAL_ASSET_LIMIT;
  const documentCount = planContext?.documentCount ?? 0;
  const documentLimit = planContext?.documentLimit ?? INITIAL_ASSET_LIMIT;
  const subscriptionCount = planContext?.subscriptionCount ?? 0;
  const subscriptionLimit = planContext?.subscriptionLimit ?? INITIAL_ASSET_LIMIT;
  const invoiceUploadCount = planContext?.invoiceUploadCount ?? 0;
  const invoiceUploadLimit = planContext?.invoiceUploadLimit ?? INITIAL_ASSET_LIMIT;
  const isFreePlan = plan === "free";
  const userIdShort =
    userId && userId.length > 8 ? `${userId.slice(0, 8)}...` : (userId ?? "-");
  const normalizedItems = useMemo(() => {
    const hasAssetsItem = items.some((item) => item.href === ASSETS_NAV_ITEM.href);
    const withAssetsItem = hasAssetsItem ? items : [...items, ASSETS_NAV_ITEM];
    return orderSidebarItems(withAssetsItem);
  }, [items]);

  const usageLimit = assetLimit ?? INITIAL_ASSET_LIMIT;
  const formatUsage = (count: number, limit: number | null) => `${count}/${limit ?? SIDEBAR_TEXT.infiniteLimit}`;
  const usagePercent = useMemo(() => {
    if (!isFreePlan || usageLimit <= 0) {
      return 100;
    }
    const ratios = [
      assetLimit && assetLimit > 0 ? assetCount / assetLimit : 0,
      documentLimit && documentLimit > 0 ? documentCount / documentLimit : 0,
      subscriptionLimit && subscriptionLimit > 0
        ? subscriptionCount / subscriptionLimit
        : 0,
      invoiceUploadLimit && invoiceUploadLimit > 0
        ? invoiceUploadCount / invoiceUploadLimit
        : 0,
    ];
    const highestRatio = Math.max(...ratios);
    return Math.max(0, Math.min(100, Math.round(highestRatio * 100)));
  }, [
    isFreePlan,
    assetCount,
    assetLimit,
    documentCount,
    documentLimit,
    invoiceUploadCount,
    invoiceUploadLimit,
    subscriptionCount,
    subscriptionLimit,
    usageLimit,
  ]);
  const nextBillingDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }, []);

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
        {/* Scroll container: all sidebar content below the brand section scrolls here. */}
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar pb-2 pr-1 overscroll-contain">
          <div className="flex min-h-full flex-col">
            <nav aria-label={SIDEBAR_ARIA_LABEL} className="auth-nav-list">
              {normalizedItems.map((item) => {
                const active = isHydrated ? isActivePath(pathname ?? "", item.href) : false;
                const displayLabel = getDisplayLabel(item);
                const shortLabel = getShortLabel(item, displayLabel);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? displayLabel : undefined}
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
                          <span className="truncate font-medium">{displayLabel}</span>
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
              <div className="auth-sidebar-footer mt-3 flex flex-col gap-3 pb-3">
                {showPlanDebug ? (
                  <p className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                    DEBUG Plan: {plan} | User: {userIdShort}
                  </p>
                ) : null}
                {isFreePlan ? (
                  <article className="auth-plan-card auth-plan-card-free rounded-xl p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100">{FREE_PLAN_LABEL}</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--auth-foreground)]">
                      {SIDEBAR_TEXT.usageAssets}: {formatUsage(assetCount, assetLimit)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--auth-muted)]">
                      {SIDEBAR_TEXT.usageDocuments}: {formatUsage(documentCount, documentLimit)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--auth-muted)]">
                      {SIDEBAR_TEXT.usageSubscriptions}: {formatUsage(subscriptionCount, subscriptionLimit)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--auth-muted)]">
                      {SIDEBAR_TEXT.usageInvoiceUploads}:{" "}
                      {formatUsage(invoiceUploadCount, invoiceUploadLimit)}
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
                      {SIDEBAR_TEXT.upgradeCta}
                    </Link>
                  </article>
                ) : (
                  <article className="auth-plan-card auth-plan-card-premium rounded-xl p-3">
                    <p className="inline-flex items-center rounded-full border border-[rgb(16_239_181_/_0.35)] bg-[rgb(16_239_181_/_0.15)] px-2 py-1 text-xs font-semibold text-[var(--auth-primary)]">
                      {SIDEBAR_TEXT.premiumMemberBadge}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--auth-foreground)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--auth-primary)]" />
                      {SIDEBAR_TEXT.unlimitedAssetsStatus}
                    </p>
                    <p className="mt-2 text-xs text-[var(--auth-muted)]">
                      {SIDEBAR_TEXT.nextInvoicePrefix}: <span suppressHydrationWarning>{nextBillingDate}</span>
                    </p>
                  </article>
                )}

                {footer ? <div>{footer}</div> : null}
              </div>
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
