import type { ReactNode } from "react";
import Link from "next/link";
import { legalLinks } from "@/app/legal/legal-links";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="premium-panel h-fit p-5 lg:sticky lg:top-6">
          <Link href="/" className="block">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly</p>
            <p className="mt-2 text-lg font-semibold text-foreground">Yasal Metinler</p>
            <p className="mt-1 text-sm text-muted-foreground">SaaS kullanım ve veri politikaları</p>
          </Link>

          <nav className="mt-6 space-y-2">
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="premium-panel px-6 py-10 sm:px-10">{children}</section>
      </div>
    </main>
  );
}
