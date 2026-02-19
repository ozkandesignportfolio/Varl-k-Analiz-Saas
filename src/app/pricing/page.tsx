"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "annual";

type FeatureRow = {
  feature: string;
  free: string;
  premium: string;
};

const MONTHLY_PREMIUM_PRICE = 149;
const ANNUAL_REGULAR_PRICE = 12 * MONTHLY_PREMIUM_PRICE;
const ANNUAL_DISCOUNTED_PRICE = 1490;

const featureRows: FeatureRow[] = [
  { feature: "Varlık sayısı", free: "3", premium: "Sınırsız" },
  { feature: "Bakım kuralı", free: "✓", premium: "✓" },
  { feature: "Servis geçmişi", free: "✓", premium: "✓" },
  { feature: "Belge kasası", free: "50 MB", premium: "5 GB" },
  { feature: "PDF rapor export", free: "✗", premium: "✓" },
  { feature: "Otomasyon (bildirim/email)", free: "✗", premium: "✓" },
  { feature: "QR kod erişimi", free: "✓", premium: "✓" },
  { feature: "Öncelikli destek", free: "✗", premium: "✓" },
];

const toTl = (amount: number) => `${new Intl.NumberFormat("tr-TR").format(amount)}₺`;

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const isAnnual = billingCycle === "annual";

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl space-y-5">
        <header className="premium-panel p-6">
          <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            AssetCare Planları
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Ücretsiz başla, Premium ile ölçekle</h1>
          <p className="mt-2 text-sm text-slate-300">
            Premium: 149 TL/ay. Sınırsız varlık, PDF export, otomasyon ve öncelikli destek.
          </p>

          <div className="mt-5 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                billingCycle === "monthly" ? "bg-white text-slate-900" : "text-slate-200 hover:text-white",
              )}
            >
              Aylık
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                isAnnual ? "bg-white text-slate-900" : "text-slate-200 hover:text-white",
              )}
            >
              Yıllık %17
            </button>
          </div>

          {isAnnual ? (
            <p className="mt-3 text-sm font-medium text-emerald-200">1.788₺ → 1.490₺ yıllık %17 indirim</p>
          ) : null}
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="premium-card p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ücretsiz</p>
            <p className="mt-3 text-4xl font-semibold text-white">0₺</p>
            <p className="mt-1 text-sm text-slate-300">3 varlığa kadar temel takip</p>

            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              <li>✓ 3 varlık limiti</li>
              <li>✓ Temel bakım kuralları</li>
              <li>✗ PDF export yok</li>
              <li>✗ Otomasyon yok</li>
            </ul>

            <Link
              href="/register?plan=free"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Ücretsiz Başla
            </Link>
          </article>

          <article
            className="premium-card relative border border-indigo-400/55 p-6"
            style={{ boxShadow: "0 0 30px rgba(99,102,241,0.3)" }}
          >
            <span className="absolute right-5 top-5 rounded-full border border-indigo-300/40 bg-indigo-500/25 px-3 py-1 text-xs font-semibold text-indigo-100">
              En Çok Tercih Edilen
            </span>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Premium</p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {isAnnual ? toTl(ANNUAL_DISCOUNTED_PRICE) : `${toTl(MONTHLY_PREMIUM_PRICE)}`}
            </p>
            <p className="mt-1 text-sm text-slate-200">{isAnnual ? "Yıllık ödeme" : "Aylık ödeme"}</p>
            {isAnnual ? (
              <p className="mt-2 text-xs text-emerald-200">{toTl(ANNUAL_REGULAR_PRICE)} yerine yıllık avantajlı fiyat</p>
            ) : null}

            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>✓ Sınırsız varlık</li>
              <li>✓ PDF rapor export</li>
              <li>✓ Otomasyon (bildirim/email)</li>
              <li>✓ Öncelikli destek</li>
            </ul>

            <Link
              href="/register?plan=premium"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_22px_rgba(99,102,241,0.5)]"
            >
              Premium&apos;u Başlat
            </Link>
          </article>
        </section>

        <section className="premium-panel overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-white">Özellik Karşılaştırması</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-300">
                  <th className="px-5 py-3 font-medium">Özellik</th>
                  <th className="px-5 py-3 font-medium">Ücretsiz</th>
                  <th className="px-5 py-3 font-medium">Premium</th>
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row) => (
                  <tr key={row.feature} className="border-b border-white/10 text-slate-100">
                    <td className="px-5 py-3">{row.feature}</td>
                    <td className="px-5 py-3">{row.free}</td>
                    <td className="px-5 py-3">{row.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
