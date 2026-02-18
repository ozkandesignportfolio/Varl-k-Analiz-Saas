"use client";

import Link from "next/link";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#070b18] p-6 text-slate-100">
        <main className="mx-auto max-w-2xl">
          <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Kritik Hata</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Uygulama gecici olarak kullanilamiyor</h1>
            <p className="mt-3 text-sm text-slate-300">
              Sistem guvenli moda alindi. Sayfayi yeniden deneyin veya panele donun.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Yeniden Dene
              </button>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100"
              >
                Panele Don
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
