"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatStorageBytes, getPlanConfig, getUserPlanConfig, type PlanConfig } from "@/lib/plans/plan-config";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AppShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions?: ReactNode;
  badge?: string;
};

const navItems = [
  { href: "/dashboard", label: "Gösterge", short: "GS" },
  { href: "/assets", label: "Varlıklar", short: "VR" },
  { href: "/maintenance", label: "Bakım", short: "BK" },
  { href: "/services", label: "Servisler", short: "SR" },
  { href: "/documents", label: "Belgeler", short: "BG" },
  { href: "/timeline", label: "Zaman Akışı", short: "ZA" },
  { href: "/costs", label: "Maliyet", short: "ML" },
  { href: "/billing", label: "Abonelikler", short: "AB" },
  { href: "/reports", label: "Raporlar", short: "RP" },
];

const isActivePath = (pathname: string, href: string) => {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
};

const DEFAULT_PLAN_CONFIG: PlanConfig = getPlanConfig("starter");

export function AppShell({ title, subtitle, children, actions, badge }: AppShellProps) {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [planConfig, setPlanConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);

  useEffect(() => {
    const loadPlan = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setPlanConfig(getUserPlanConfig(user));
    };

    void loadPlan();
  }, [supabase]);

  const storageLimitText =
    planConfig.limits.maxDocumentStorageBytes === null
      ? "Belge depolama: yuksek limit"
      : `Belge depolama limiti: ${formatStorageBytes(planConfig.limits.maxDocumentStorageBytes)}`;

  const featureStatusText = planConfig.features.canUseAdvancedAnalytics
    ? "Gelismis analitik ve PDF rapor aktif"
    : "Temel erisim aktif. Pro ile gelismis analitik ve PDF rapor acilir";

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="relative mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="premium-panel sticky top-4 hidden h-fit ui-pad lg:block">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[calc(var(--ui-radius)-2px)] border border-white/10 px-3 py-2.5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400 text-xs font-bold text-slate-950">
              AC
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">AssetCare</p>
              <p className="text-sm font-semibold text-white">Premium Panel</p>
            </div>
          </Link>

          <nav className="mt-4 space-y-2">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`menu-link flex items-center justify-between rounded-[calc(var(--ui-radius)-2px)] border px-3 py-2.5 text-sm ${
                    active
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] tracking-wider ${
                      active
                        ? "border-white/30 text-white"
                        : "border-white/15 text-slate-400"
                    }`}
                  >
                    {item.short}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-[calc(var(--ui-radius)-2px)] border border-white/10 bg-white/[0.03] px-3 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Abonelik</p>
            <p className="mt-2 text-sm text-slate-200">{planConfig.label} plani aktif</p>
            <p className="mt-1 text-xs text-slate-400">{featureStatusText}</p>
            <p className="mt-1 text-xs text-slate-400">{storageLimitText}</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          <header className="premium-panel ui-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-slate-300 lg:hidden"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-400 text-[9px] font-bold text-slate-950">
                    AC
                  </span>
                  AssetCare
                </Link>
                {badge ? (
                  <p className="inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                    {badge}
                  </p>
                ) : null}
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
              </div>
              {actions ? (
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">{actions}</div>
              ) : null}
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`menu-chip shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      active
                        ? "border-sky-300/35 bg-sky-300/12 text-sky-100"
                        : "border-white/15 bg-white/5 text-slate-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
