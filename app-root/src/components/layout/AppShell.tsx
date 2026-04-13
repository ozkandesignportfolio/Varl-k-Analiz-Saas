"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/header/AppHeader";
import { SIDEBAR_LABEL_BY_KEY, SIDEBAR_NAV_ITEMS } from "@/constants/sidebar-nav";
import { NAV_TEXT } from "@/constants/ui-text";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AppShellProps = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  actions?: ReactNode;
  badge?: string;
  pageRootTestId?: string;
  pageContentTestId?: string;
};

type AppShellSessionContextValue = {
  isSessionReady: boolean;
  userEmail: string | null;
  userId: string | null;
};

const TITLE_MAP: Record<string, string> = {
  dashboard: SIDEBAR_LABEL_BY_KEY.dashboard,
  assets: SIDEBAR_LABEL_BY_KEY.assets,
  maintenance: SIDEBAR_LABEL_BY_KEY.maintenance,
  services: SIDEBAR_LABEL_BY_KEY.services,
  documents: SIDEBAR_LABEL_BY_KEY.documents,
  timeline: SIDEBAR_LABEL_BY_KEY.timeline,
  expenses: SIDEBAR_LABEL_BY_KEY.expenses,
  billing: SIDEBAR_LABEL_BY_KEY.billing,
  invoices: SIDEBAR_LABEL_BY_KEY.invoices,
  reports: SIDEBAR_LABEL_BY_KEY.reports,
  notifications: SIDEBAR_LABEL_BY_KEY.notifications,
  settings: SIDEBAR_LABEL_BY_KEY.settings,
  subscriptions: SIDEBAR_LABEL_BY_KEY.billing,
  costs: SIDEBAR_LABEL_BY_KEY.costs,
  "fraud-dashboard": "Fraud Intelligence",
};
const subscribeToHydration = () => () => {};
const AppShellSessionContext = createContext<AppShellSessionContextValue>({
  isSessionReady: false,
  userEmail: null,
  userId: null,
});

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

export const useAppShellSession = () => useContext(AppShellSessionContext);

export function AppShell({
  title,
  subtitle,
  children,
  actions,
  badge,
  pageRootTestId,
  pageContentTestId,
}: AppShellProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessionState, setSessionState] = useState<AppShellSessionContextValue>({
    isSessionReady: false,
    userEmail: null,
    userId: null,
  });
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  useEffect(() => {
    let isCancelled = false;

    const syncSessionState = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isCancelled) {
        return;
      }

      setSessionState({
        isSessionReady: true,
        userEmail: session?.user?.email ?? null,
        userId: session?.user?.id ?? null,
      });
    };

    void syncSessionState();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: unknown, session: Session | null) => {
      if (isCancelled) {
        return;
      }

      setSessionState({
        isSessionReady: true,
        userEmail: session?.user?.email ?? null,
        userId: session?.user?.id ?? null,
      });
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const resolvedTitle = title ?? getFallbackTitle(pathname);
  const breadcrumb = buildBreadcrumb(pathname);
  const primarySegment = pathname.split("/").filter(Boolean)[0] ?? "home";
  const resolvedPageRootTestId = pageRootTestId ?? `${primarySegment}-root`;
  const resolvedPageContentTestId = pageContentTestId ?? `${primarySegment}-content`;

  return (
    <AppShellSessionContext.Provider value={sessionState}>
      <div className="auth-shell-theme min-h-screen" data-testid="app-shell-root">
        <Sidebar className="auth-shell-sidebar fixed left-0 top-0 z-50 hidden h-screen w-[var(--auth-sidebar-width)] lg:flex" />

        <div className="auth-shell-layout lg:pl-[var(--auth-sidebar-width)]">
          <AppHeader 
            title={resolvedTitle} 
            breadcrumb={breadcrumb} 
            userEmail={sessionState.userEmail} 
            userId={sessionState.userId} 
          />

        <main className="auth-shell-main px-4 py-4 sm:px-6 lg:px-8" data-testid={resolvedPageRootTestId}>
          <nav aria-label="Mobil menü" className="auth-mobile-nav mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {SIDEBAR_NAV_ITEMS.map((item) => {
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
                  <span className="auth-nav-short-badge">{item.shortCode}</span>
                </Link>
              );
            })}
          </nav>

          {badge || subtitle || actions ? (
            <section className="auth-shell-card auth-shell-intro mb-5 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  {badge ? <p className="auth-section-chip">{badge}</p> : null}
                  {subtitle ? <p className="auth-section-subtitle text-sm">{subtitle}</p> : null}
                </div>
                {actions ? <div className="auth-shell-actions flex items-center gap-2">{actions}</div> : null}
              </div>
            </section>
          ) : null}

          <div className="auth-shell-content" data-testid={resolvedPageContentTestId}>
            {children}
          </div>
        </main>
        </div>
      </div>
    </AppShellSessionContext.Provider>
  );
}
