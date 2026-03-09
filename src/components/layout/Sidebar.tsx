"use client";

import type { ReactNode } from "react";
import { useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { PlanContext } from "@/contexts/PlanContext";
import { SIDEBAR_TEXT } from "@/constants/ui-text";
import { sidebarNavItems } from "@/components/layout/sidebar/nav-items";
import { SidebarFooter, type PlanDebugResponse } from "@/components/layout/sidebar/SidebarFooter";
import { SidebarItem } from "@/components/layout/sidebar/SidebarItem";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed?: boolean;
  brand?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onNavigate?: () => void;
};

const SIDEBAR_ARIA_LABEL = SIDEBAR_TEXT.ariaLabel;
const INITIAL_ASSET_LIMIT = 3;
const subscribeToHydration = () => () => {};

const isActivePath = (pathname: string, href: string) => {
  return pathname === href || pathname.startsWith(`${href}/`);
};

export function Sidebar({ collapsed = false, brand, footer, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [planDebug, setPlanDebug] = useState<PlanDebugResponse | null>(null);
  const planContext = useContext(PlanContext);
  const plan = planContext?.plan ?? "free";
  const showPlanDebug = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_PLAN_DEBUG === "true";
  const sidebarPlanLabel = plan === "premium" ? "Premium" : "Deneme";
  const assetCount = planContext?.assetCount ?? 0;
  const assetLimit = planContext?.assetLimit ?? INITIAL_ASSET_LIMIT;
  const documentCount = planContext?.documentCount ?? 0;
  const documentLimit = planContext?.documentLimit ?? INITIAL_ASSET_LIMIT;
  const subscriptionCount = planContext?.subscriptionCount ?? 0;
  const subscriptionLimit = planContext?.subscriptionLimit ?? INITIAL_ASSET_LIMIT;
  const invoiceUploadCount = planContext?.invoiceUploadCount ?? 0;
  const invoiceUploadLimit = planContext?.invoiceUploadLimit ?? INITIAL_ASSET_LIMIT;
  const normalizedItems = useMemo(() => sidebarNavItems, []);

  useEffect(() => {
    if (!showPlanDebug) {
      return;
    }

    const controller = new AbortController();

    const loadPlanDebug = async () => {
      try {
        const response = await fetch("/api/debug/plan", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as PlanDebugResponse;

        if (!controller.signal.aborted) {
          setPlanDebug(payload);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPlanDebug({
          ok: false,
          error: error instanceof Error ? error.message : "debug_plan_fetch_failed",
        });
      }
    };

    void loadPlanDebug();

    return () => {
      controller.abort();
    };
  }, [showPlanDebug]);

  return (
    <aside className={cn("auth-shell-sidebar ui-pad flex h-full flex-col overflow-hidden", className)}>
      <div className="mb-6 flex-none">
        {brand ?? (
          <Link
            href="/"
            onClick={onNavigate}
            aria-label="Assetly ana sayfa"
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
                <p className="text-xs font-bold tracking-tight text-[var(--auth-foreground)]">ASSETLY</p>
                <p className="text-[9px] text-[var(--auth-muted)]">{sidebarPlanLabel}</p>
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
                return (
                  <SidebarItem
                    key={item.key}
                    item={item}
                    collapsed={collapsed}
                    active={isHydrated ? isActivePath(pathname ?? "", item.href) : false}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </nav>

            {!collapsed ? (
              <SidebarFooter
                plan={plan}
                assetCount={assetCount}
                assetLimit={assetLimit}
                documentCount={documentCount}
                documentLimit={documentLimit}
                subscriptionCount={subscriptionCount}
                subscriptionLimit={subscriptionLimit}
                invoiceUploadCount={invoiceUploadCount}
                invoiceUploadLimit={invoiceUploadLimit}
                showPlanDebug={showPlanDebug}
                planDebug={planDebug}
                footer={footer}
                onNavigate={onNavigate}
              />
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
