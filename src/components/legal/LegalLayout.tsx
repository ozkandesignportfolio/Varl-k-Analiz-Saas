import Link from "next/link";
import type { ReactNode } from "react";

type LegalLayoutProps = {
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: ReactNode;
};

type LegalSectionProps = {
  title: string;
  id?: string;
  children: ReactNode;
};

export function LegalLayout({ title, subtitle, lastUpdated, children }: LegalLayoutProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="premium-panel p-6 sm:p-8 lg:p-10">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AssetCare Legal</p>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.1] text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{subtitle}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Last updated: {lastUpdated}</p>
        </header>

        <div className="mt-8 space-y-10 text-[0.98rem] leading-8 text-slate-200">{children}</div>

        <footer className="mt-10 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <Link
            href="/"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-sky-300/60 hover:bg-white/10"
          >
            Back to homepage
          </Link>
          <Link
            href="/faq"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:border-sky-300/60 hover:bg-white/10"
          >
            Read FAQ
          </Link>
        </footer>
      </article>
    </main>
  );
}

export function LegalSection({ title, id, children }: LegalSectionProps) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-xl font-semibold leading-[1.1] text-white sm:text-2xl">{title}</h2>
      <div className="space-y-4 text-slate-200">{children}</div>
    </section>
  );
}
