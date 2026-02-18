"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const reportRuntimeError = (error: Error) => {
  const reporter = (window as Window & { reportError?: (value: unknown) => void }).reportError;
  if (typeof reporter === "function") {
    reporter(error);
  }
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    reportRuntimeError(error);
  }, [error]);

  return (
    <AppShell
      badge="Hata"
      title="Bir seyler ters gitti"
      subtitle="Islem gecici olarak tamamlanamadi. Guvenli bir sekilde devam etmek icin asagidaki adimlari kullanin."
    >
      <section className="premium-card ui-pad">
        <p className="text-sm text-slate-200">
          Beklenmeyen bir hata olustu. Sayfayi yeniden denemek genellikle problemi cozer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Tekrar Dene
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100"
          >
            Panele Don
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
