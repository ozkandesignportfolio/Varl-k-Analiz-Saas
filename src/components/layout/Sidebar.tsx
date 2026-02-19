"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, type LucideIcon } from "lucide-react";
import { usePlanContext } from "@/contexts/PlanContext";
import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon?: LucideIcon;
  isNew?: boolean;
};

type SidebarProps = {
  items: SidebarNavItem[];
  collapsed?: boolean;
  brand?: ReactNode;
  footer?: ReactNode;
  className?: string;
  onNavigate?: () => void;
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
  const { plan, assetCount, assetLimit } = usePlanContext();
  const isFreePlan = plan === "free";

  const usageLimit = assetLimit ?? 3;
  const usagePercent = useMemo(() => {
    if (!isFreePlan || usageLimit <= 0) {
      return 100;
    }
    return Math.max(0, Math.min(100, Math.round((assetCount / usageLimit) * 100)));
  }, [assetCount, isFreePlan, usageLimit]);

  const nextBillingDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }, []);

  return (
    <aside className={cn("auth-shell-sidebar ui-pad flex h-full flex-col", className)}>
      <div className="mb-6">
        {brand ?? (
          <Link
            href="/"
            onClick={onNavigate}
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

      <nav aria-label="Ana menü" className="auth-nav-list">
        {items.map((item) => {
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
                "auth-nav-item auth-focus-ring flex items-center rounded-lg px-3 py-2 text-xs",
                collapsed ? "justify-center px-2.5" : "justify-between gap-3",
              )}
            >
              {collapsed ? (
                Icon ? (
                  <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-md">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="auth-nav-short-badge relative z-10 rounded-md px-2 py-0.5 text-[10px] tracking-tight">
                    {shortLabel}
                  </span>
                )
              ) : (
                <>
                  <span className="relative z-10 flex min-w-0 items-center gap-2.5">
                    {Icon ? (
                      <span className="inline-flex items-center justify-center">
                        <Icon className="auth-nav-icon h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="auth-nav-meta relative z-10">
                    {item.isNew ? <span className="auth-nav-new-chip">YENİ</span> : null}
                    <span className="auth-nav-short-badge">{shortLabel}</span>
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="auth-sidebar-footer mt-4 flex flex-1 flex-col justify-end gap-3">
          {isFreePlan ? (
            <article className="auth-plan-card auth-plan-card-free rounded-xl p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-100">Ücretsiz Plan</p>
              <p className="mt-2 text-sm font-semibold text-[var(--auth-foreground)]">{assetCount} / {usageLimit} Varlık</p>
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
      ) : null}
    </aside>
  );
}
