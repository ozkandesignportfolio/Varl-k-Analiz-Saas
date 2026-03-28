"use client";

import Link from "next/link";

const trustPills = ["✓ Kurulum 5 dk", "✓ Kredi kartı yok", "✓ İstediğin zaman iptal"];

export default function FinalCtaSection() {
  return (
    <section className="relative isolate motion-fade-up motion-delay-4 rounded-2xl border border-indigo-300/40 bg-[#090f1f] p-7 shadow-[0_0_0_1px_rgba(129,140,248,0.22),0_0_42px_rgba(99,102,241,0.28)]">
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/20 blur-2xl" />
      <h2 className="text-4xl font-semibold tracking-tight text-white">Bugün Başlayın</h2>
      <p className="mt-3 max-w-2xl text-base text-slate-300">
        Ücretsiz plan, kredi kartı gerektirmez. 3 varlığa kadar sonsuza kadar ücretsiz.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-base font-semibold text-white transition hover:opacity-90"
        >
          Ücretsiz Kayıt Ol
        </Link>
        <a
          href="#fiyatlandirma"
          className="rounded-full border border-white/25 bg-white/5 px-6 py-3 text-base font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Önce Fiyatları Gör
        </a>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {trustPills.map((pill) => (
          <span
            key={pill}
            className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-200"
          >
            {pill}
          </span>
        ))}
      </div>
    </section>
  );
}
