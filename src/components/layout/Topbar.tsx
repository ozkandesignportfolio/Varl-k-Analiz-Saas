"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type TopbarProps = {
  title: string;
  breadcrumb: string;
  userEmail?: string | null;
};

const getUserInitial = (email?: string | null) => {
  if (!email) {
    return "A";
  }

  return email.charAt(0).toLocaleUpperCase("tr-TR");
};

export function Topbar({ title, breadcrumb, userEmail }: TopbarProps) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const userMenuRef = useRef<HTMLDetailsElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleOpenNotifications = useCallback(() => {
    router.push("/notifications");
  }, [router]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message || "C\u0131k\u0131\u015F yap\u0131lamad\u0131. L\u00FCtfen tekrar deneyin.");
      setIsSigningOut(false);
      return;
    }

    if (userMenuRef.current) {
      userMenuRef.current.open = false;
    }

    router.replace("/login");
    router.refresh();
  }, [isSigningOut, router, supabase]);

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
            onClick={handleOpenNotifications}
            className="auth-topbar-control auth-focus-ring relative inline-flex h-9 w-9 items-center justify-center rounded-lg"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--auth-primary)]" />
          </button>

          <span className="auth-topbar-separator" aria-hidden />

          <details ref={userMenuRef} className="auth-topbar-menu relative">
            <summary
              aria-label="Kullan\u0131c\u0131 men\u00FCs\u00FC"
              className="auth-topbar-control auth-focus-ring flex list-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-[var(--auth-foreground)] [&::-webkit-details-marker]:hidden"
            >
              <span className="auth-topbar-avatar inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                {getUserInitial(userEmail)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--auth-muted)]" />
            </summary>

            <div className="auth-topbar-menu-panel absolute right-0 mt-2 w-56 rounded-xl p-2">
              <p className="truncate px-2 py-1 text-xs text-[var(--auth-muted)]">{userEmail ?? "kullan\u0131c\u0131@assetcare.app"}</p>
              <Link
                href="/settings"
                className="auth-topbar-menu-link auth-focus-ring mt-1 block rounded-md px-2 py-1.5 text-sm text-[var(--auth-muted)]"
              >
                {"Hesap Ayarlar\u0131"}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="auth-topbar-menu-link auth-focus-ring mt-1 block w-full rounded-md px-2 py-1.5 text-left text-sm text-rose-200 disabled:opacity-60"
              >
                {isSigningOut ? "C\u0131k\u0131\u015F yap\u0131l\u0131yor..." : "\u00C7\u0131k\u0131\u015F Yap"}
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
