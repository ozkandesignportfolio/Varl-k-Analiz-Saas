"use client";

import Link from "next/link";
import { memo } from "react";
import {
  Bell,
  Clock3,
  CreditCard,
  FileText,
  FolderOpen,
  HandCoins,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { SidebarNavIconKey } from "@/constants/sidebar-nav";
import { cn } from "@/lib/utils";
import type { SidebarMenuItem } from "@/components/layout/sidebar/nav-items";

type SidebarItemProps = {
  item: SidebarMenuItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
};

const iconByKey: Record<SidebarNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  package: Package,
  wrench: Wrench,
  "folder-open": FolderOpen,
  clock: Clock3,
  "hand-coins": HandCoins,
  bell: Bell,
  "credit-card": CreditCard,
  receipt: Receipt,
  "trending-up": TrendingUp,
  "file-text": FileText,
  settings: Settings,
};

export const SidebarItem = memo(function SidebarItem({ item, collapsed, active, onNavigate }: SidebarItemProps) {
  const Icon = iconByKey[item.iconKey];

  return (
    <Link
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
            {item.shortCode}
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
            <span className="auth-nav-short-badge">{item.shortCode}</span>
          </span>
        </>
      )}
    </Link>
  );
});
