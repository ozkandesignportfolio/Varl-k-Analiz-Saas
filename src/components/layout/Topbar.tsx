"use client";

import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";

type TopbarProps = {
  title: string;
  breadcrumb: string;
  userEmail?: string | null;
};

const getUserInitial = (email?: string | null) => {
  if (!email) {
    return "A";
  }

  return email.charAt(0).toUpperCase();
};

export function Topbar({ title, breadcrumb, userEmail }: TopbarProps) {
  return (
    <header className="auth-shell-topbar sticky top-0 z-40 h-16">
      <div className="auth-topbar-inner flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="auth-topbar-breadcrumb truncate text-[11px]">{breadcrumb}</p>
          <h1 className="truncate text-sm font-semibold text-[var(--auth-foreground)] sm:text-base">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Bildirimler"
            className="auth-topbar-control auth-focus-ring relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--auth-primary)]" />
          </button>

          <span className="auth-topbar-separator" aria-hidden />

          <details className="auth-topbar-menu relative">
            <summary
              aria-label="Kullanıcı menüsü"
              className="auth-topbar-control auth-focus-ring flex list-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[var(--auth-foreground)] [&::-webkit-details-marker]:hidden"
            >
              <span className="auth-topbar-avatar inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                {getUserInitial(userEmail)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--auth-muted)]" />
            </summary>

            <div className="auth-topbar-menu-panel absolute right-0 mt-2 w-56 rounded-xl p-2">
              <p className="truncate px-2 py-1 text-xs text-[var(--auth-muted)]">{userEmail ?? "kullanici@assetcare.app"}</p>
              <Link
                href="/settings"
                className="auth-topbar-menu-link auth-focus-ring mt-1 block rounded-md px-2 py-1.5 text-sm text-[var(--auth-muted)]"
              >
                Hesap Ayarları
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
