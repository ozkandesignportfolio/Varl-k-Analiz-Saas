"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const groups = [
  {
    title: "Genel",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "\u25A3" }],
  },
  {
    title: "Varl\u0131k",
    items: [
      { href: "/assets", label: "Varl\u0131klar", icon: "\u25FC" },
      { href: "/maintenance", label: "Bak\u0131m S\u00fcre\u00e7leri", icon: "\u27F3" },
      { href: "/services", label: "Servis & Bak\u0131m", icon: "\uD83D\uDEE0" },
      { href: "/documents", label: "Belge Kasas\u0131", icon: "\uD83D\uDCC4" },
    ],
  },
  {
    title: "Finans",
    items: [
      { href: "/expenses", label: "Finans", icon: "\u20BA" },
      { href: "/billing", label: "Faturalar", icon: "\uD83E\uDDFE" },
      { href: "/subscriptions", label: "Abonelikler", icon: "\u2605" },
    ],
  },
  {
    title: "Analiz",
    items: [
      { href: "/reports", label: "Raporlar", icon: "\uD83D\uDCCA" },
      { href: "/notifications", label: "Bildirimler", icon: "\uD83D\uDD14" },
    ],
  },
];

const isActivePath = (path: string, href: string) => {
  if (href === "/dashboard") return path === href;
  return path === href || path.startsWith(`${href}/`);
};

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-background/60 backdrop-blur">
      <div className="border-b p-4">
        <div className="font-semibold tracking-tight">AssetCare</div>
        <Badge variant="secondary" className="mt-1 text-[10px]">
          Premium Panel
        </Badge>
      </div>

      <nav className="space-y-4 p-3">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-tight text-muted-foreground">
              {group.title}
            </div>

            <Card className="border-0 bg-muted/40 p-1">
              {group.items.map((item) => {
                const active = isActivePath(path, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="w-5 text-center text-xs">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </Card>
          </div>
        ))}
      </nav>

      <div className="mt-auto p-3">
        <Card className="p-3 text-xs text-muted-foreground">
          Plan: Free
          <Link href="/billing" className="mt-2 block text-foreground underline">
            Y\u00fckselt \u2192
          </Link>
        </Card>
      </div>
    </aside>
  );
}
