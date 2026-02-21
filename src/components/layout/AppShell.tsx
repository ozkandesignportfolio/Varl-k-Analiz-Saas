"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Box,
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
  { href: "/dashboard", label: "Gösterge", shortLabel: "GS", icon: LayoutDashboard },
  { href: "/assets", label: "Varlıklar", shortLabel: "VR", icon: Box },
  { href: "/maintenance", label: "Bakım", shortLabel: "BK", icon: Wrench },
  { href: "/services", label: "Servisler", shortLabel: "SR", icon: Wrench },
  { href: "/documents", label: "Belgeler", shortLabel: "BG", icon: FolderOpen },
  { href: "/timeline", label: "Zaman Akışı", shortLabel: "ZA", icon: Clock3 },
  { href: "/expenses", label: "Giderler", shortLabel: "GD", icon: HandCoins },
  { href: "/notifications", label: "Bildirimler", shortLabel: "BL", icon: Bell },
  { href: "/billing", label: "Abonelikler", shortLabel: "AB", icon: CreditCard },
  { href: "/invoices", label: "Fatura Takip", shortLabel: "FT", icon: Receipt },
  { href: "/costs", label: "Skor Analizi", shortLabel: "SK", icon: TrendingUp },
  { href: "/reports", label: "Raporlar", shortLabel: "RP", icon: FileText },
  { href: "/settings", label: "Ayarlar", shortLabel: "AY", icon: Settings },
];

const TITLE_MAP: Record<string, string> = {
  dashboard: "Gösterge",
  assets: "Varlıklar",
  maintenance: "Bakım",
  services: "Servisler",
  documents: "Belgeler",
  timeline: "Zaman Akışı",
  expenses: "Giderler",
  billing: "Abonelikler",
  invoices: "Faturalar",
  reports: "Raporlar",
  notifications: "Bildirimler",
  settings: "Ayarlar",
  subscriptions: "Abonelikler",
  costs: "Maliyetler",
};

const isActivePath = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
};

const getFallbackTitle = (pathname: string) => {
  const [first] = pathname.split("/").filter(Boolean);
  if (!first) {
    return "Panel";
  }

  return TITLE_MAP[first] ?? "Panel";
};

const buildBreadcrumb = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return "Panel";
  }

  const readableParts = parts.map((part, index) => {
    if (index > 0 && parts[0] === "assets") {
      return "Detay";
    }

    return TITLE_MAP[part] ?? part;
  });

  return ["Panel", ...readableParts].join(" / ");
};

export function AppShell({ title, subtitle, children, actions, badge }: AppShellProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    };

    void loadSession();
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
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-state={active ? "active" : "inactive"}
                  className="auth-shell-chip auth-focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                >
                  <span>{item.label}</span>
                  <span className="auth-nav-short-badge">{item.shortLabel ?? item.label.slice(0, 2).toUpperCase()}</span>
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

