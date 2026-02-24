"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Bell,
  Package,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Settings,
  TrendingUp,
  Wrench,
  FolderOpen,
  HandCoins,
} from "lucide-react";
import { Sidebar, type SidebarNavItem } from "@/components/layout/Sidebar";
import { NAV_TEXT } from "@/constants/ui-text";
import { Topbar } from "@/components/layout/Topbar";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AppShellProps = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  actions?: ReactNode;
  badge?: string;
};

const NAV_ITEMS: SidebarNavItem[] = [
  { href: "/dashboard", label: NAV_TEXT.dashboard, shortLabel: "GS", icon: LayoutDashboard },
  { href: "/assets", label: NAV_TEXT.assets, shortLabel: "VR", icon: Package },
  { href: "/maintenance", label: NAV_TEXT.maintenance, shortLabel: "BK", icon: Wrench },
  { href: "/services", label: NAV_TEXT.services, shortLabel: "SR", icon: Wrench },
  { href: "/documents", label: NAV_TEXT.documents, shortLabel: "BG", icon: FolderOpen },
  { href: "/timeline", label: NAV_TEXT.timeline, shortLabel: "ZA", icon: Clock3 },
  { href: "/expenses", label: NAV_TEXT.expenses, shortLabel: "GD", icon: HandCoins },
  { href: "/notifications", label: NAV_TEXT.notifications, shortLabel: "BL", icon: Bell },
  { href: "/billing", label: NAV_TEXT.billing, shortLabel: "AB", icon: CreditCard },
  { href: "/invoices", label: NAV_TEXT.invoices, shortLabel: "FT", icon: Receipt },
  { href: "/costs", label: NAV_TEXT.costs, shortLabel: "SK", icon: TrendingUp },
  { href: "/reports", label: NAV_TEXT.reports, shortLabel: "RP", icon: FileText },
  { href: "/settings", label: NAV_TEXT.settings, shortLabel: "AY", icon: Settings },
];

const TITLE_MAP: Record<string, string> = {
  dashboard: NAV_TEXT.dashboard,
  assets: NAV_TEXT.assets,
  maintenance: NAV_TEXT.maintenance,
  services: NAV_TEXT.services,
  documents: NAV_TEXT.documents,
  timeline: NAV_TEXT.timeline,
  expenses: NAV_TEXT.expenses,
  billing: NAV_TEXT.billing,
  invoices: NAV_TEXT.invoices,
  reports: NAV_TEXT.reports,
  notifications: NAV_TEXT.notifications,
  settings: NAV_TEXT.settings,
  subscriptions: NAV_TEXT.billing,
  costs: NAV_TEXT.costs,
};
const subscribeToHydration = () => () => {};

const isActivePath = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
};

const getFallbackTitle = (pathname: string) => {
  const [first] = pathname.split("/").filter(Boolean);
  if (!first) {
    return NAV_TEXT.panel;
  }

  return TITLE_MAP[first] ?? NAV_TEXT.panel;
};

const buildBreadcrumb = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return NAV_TEXT.panel;
  }

  const readableParts = parts.map((part, index) => {
    if (index > 0 && parts[0] === "assets") {
      return NAV_TEXT.detail;
    }

    return TITLE_MAP[part] ?? part;
  });

  return [NAV_TEXT.panel, ...readableParts].join(" / ");
};

export function AppShell({ title, subtitle, children, actions, badge }: AppShellProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    let isCancelled = false;

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isCancelled) {
        return;
      }

      setUserEmail(user?.email ?? null);
    };

    void loadSession();
    return () => {
      isCancelled = true;
    };
  }, [supabase]);

  const resolvedTitle = title ?? getFallbackTitle(pathname);
  const breadcrumb = buildBreadcrumb(pathname);

  return (
    <div className="auth-shell-theme min-h-screen">
      <Sidebar
        items={NAV_ITEMS}
        className="auth-shell-sidebar fixed left-0 top-0 z-50 hidden h-screen w-[var(--auth-sidebar-width)] lg:flex"
      />

      <div className="auth-shell-layout lg:pl-[var(--auth-sidebar-width)]">
        <Topbar title={resolvedTitle} breadcrumb={breadcrumb} userEmail={userEmail} />

        <main className="auth-shell-main px-4 py-4 sm:px-6 lg:px-8">
          <nav aria-label="Mobil menü" className="auth-mobile-nav mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {NAV_ITEMS.map((item) => {
              const active = isHydrated ? isActivePath(pathname ?? "", item.href) : false;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-state={active ? "active" : "inactive"}
                  className="auth-shell-chip auth-focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                >
                  <span>{item.label}</span>
                  <span className="auth-nav-short-badge">
                    {item.shortLabel ?? item.label.slice(0, 2).toLocaleUpperCase("tr-TR")}
                  </span>
                </Link>
              );
            })}
          </nav>

          {badge || subtitle || actions ? (
            <section className="auth-shell-card auth-shell-intro mb-5 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  {badge ? (
                    <p className="auth-section-chip">
                      {badge}
                    </p>
                  ) : null}
                  {subtitle ? <p className="auth-section-subtitle text-sm">{subtitle}</p> : null}
                </div>
                {actions ? <div className="auth-shell-actions flex items-center gap-2">{actions}</div> : null}
              </div>
            </section>
          ) : null}

          <div className="auth-shell-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
