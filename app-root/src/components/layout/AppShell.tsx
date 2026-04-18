"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

type MobileNavProps = {
  pathname: string;
  isHydrated: boolean;
};

type MobileNavChipProps = {
  href: string;
  label: string;
  shortCode: string;
  active: boolean;
};

// Each chip is memoized so pathname transitions only repaint the two chips
// whose `active` flag actually flipped (previous active + new active).
// Without this, every route change repaints the entire horizontal nav list
// which is the main source of mobile scroll jitter.
const MobileNavChip = memo(function MobileNavChip({ href, label, shortCode, active }: MobileNavChipProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-state={active ? "active" : "inactive"}
      className="auth-shell-chip auth-focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
    >
      <span>{label}</span>
      <span className="auth-nav-short-badge">{shortCode}</span>
    </Link>
  );
});

// Per-route scroll cache so each pathname keeps its own horizontal offset.
// AppShell remounts MobileNav on every navigation, so a Map keyed by the
// route path is the minimal way to survive remounts without adding context
// or changing component APIs. An empty string key is used as a safe fallback
// when pathname is not yet available.
const mobileNavScrollByRoute = new Map<string, number>();

const getRouteKey = (pathname: string) => pathname || "/";

const MobileNav = memo(function MobileNav({ pathname, isHydrated }: MobileNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const routeKey = getRouteKey(pathname);

  // Restore previously saved scroll position on mount and whenever the active
  // route changes, then ensure the active chip is actually visible.
  useEffect(() => {
    const node = navRef.current;
    if (!node) return;

    // Restore last known scroll position for THIS route synchronously to avoid
    // a flash at 0. If we have never visited this route before, leave at 0.
    const saved = mobileNavScrollByRoute.get(routeKey);
    if (typeof saved === "number" && saved > 0) {
      node.scrollLeft = saved;
    }

    if (!isHydrated) return;

    const active = node.querySelector<HTMLElement>('[data-state="active"]');
    if (!active) return;

    const activeLeft = active.offsetLeft;
    const activeRight = activeLeft + active.offsetWidth;
    const viewLeft = node.scrollLeft;
    const viewRight = viewLeft + node.clientWidth;

    // Only scroll the active chip into view if it is actually out of view,
    // so we never override a valid preserved position unnecessarily.
    if (activeLeft < viewLeft || activeRight > viewRight) {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
      mobileNavScrollByRoute.set(routeKey, node.scrollLeft);
    }
  }, [routeKey, isHydrated]);

  // Persist scroll position (per route) as the user scrolls chips horizontally.
  const handleScroll = () => {
    const node = navRef.current;
    if (node) {
      mobileNavScrollByRoute.set(routeKey, node.scrollLeft);
    }
  };

  return (
    <nav
      ref={navRef}
      onScroll={handleScroll}
      aria-label="Mobil menü"
      className="auth-mobile-nav mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:hidden"
      style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
    >
      {SIDEBAR_NAV_ITEMS.map((item) => (
        <MobileNavChip
          key={item.href}
          href={item.href}
          label={item.label}
          shortCode={item.shortCode}
          active={isHydrated ? isActivePath(pathname, item.href) : false}
        />
      ))}
    </nav>
  );
});

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
          <MobileNav pathname={pathname ?? ""} isHydrated={isHydrated} />

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
