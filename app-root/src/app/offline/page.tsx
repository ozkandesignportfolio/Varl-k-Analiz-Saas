"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      <section className="relative mx-auto max-w-xl premium-panel p-5 sm:p-7">
        <p className="inline-flex rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
          Çevrimdışı Mod
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          İnternet bağlantısı bulunamadı
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Bağlantı geri geldiğinde sayfa otomatik güncellenebilir. Bu sırada daha önce
          ziyaret ettiğiniz bazı ekranlar önbellekten açılabilir.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link
            href="/dashboard"
            className="rounded-full border border-sky-300/35 bg-sky-300/10 px-4 py-2 text-center text-sm font-semibold text-sky-100 transition hover:bg-sky-300/20"
          >
            Göstergeye Dön
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Tekrar Dene
          </button>
        </div>
      </section>
    </main>
  );
}

