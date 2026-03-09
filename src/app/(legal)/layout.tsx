import Link from "next/link";
import type { ReactNode } from "react";

const legalLinks = [
  { href: "/legal/privacy", label: "Gizlilik Politikası" },
  { href: "/legal/terms", label: "Kullanım Şartları" },
  { href: "/legal/kvkk", label: "KVKK Aydınlatma Metni" },
  { href: "/legal/cookies", label: "Çerez Politikası" },
  { href: "/legal/notice", label: "Hukuki Bilgilendirme" },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-4">
        <header className="premium-panel motion-fade-up sticky top-4 z-30 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-fuchsia-500 text-xs font-semibold text-white">
                AC
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Assetly</p>
                <p className="text-sm font-semibold text-white">Yasal Metinler</p>
              </div>
            </Link>

            <ul className="hidden items-center gap-3 text-sm text-slate-300 md:flex">
              {legalLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="menu-link rounded-full px-3 py-1.5 transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/dashboard" className="menu-link rounded-full px-3 py-1.5 transition hover:text-white">
                  Panel
                </Link>
              </li>
            </ul>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
              <Link
                href="/login"
                className="flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/10 sm:flex-none"
              >
                Giriş
              </Link>
              <Link
                href="/"
                className="flex-1 rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:opacity-90 sm:flex-none"
              >
                Anasayfa
              </Link>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="menu-chip shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        <section className="premium-panel motion-fade-up motion-delay-1">
          <div className="mx-auto w-full max-w-3xl px-6 py-16">{children}</div>
        </section>

        <footer className="premium-panel motion-fade-up motion-delay-2 px-6 py-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assetly Legal</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-indigo-400/70 hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
