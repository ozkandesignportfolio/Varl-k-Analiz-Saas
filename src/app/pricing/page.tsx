"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { getPlanConfig } from "@/lib/plans/plan-config";
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
const TRIAL_PLAN = getPlanConfig("starter");
const trialAssetLimit = TRIAL_PLAN.limits.assetsLimit ?? 0;
const trialDocumentLimit = TRIAL_PLAN.limits.documentsLimit ?? 0;
const trialSubscriptionLimit = TRIAL_PLAN.limits.subscriptionsLimit ?? 0;
const trialInvoiceUploadLimit = TRIAL_PLAN.limits.invoiceUploadsLimit ?? 0;

const featureRows: FeatureRow[] = [
  { feature: "Varlık sayısı", free: String(trialAssetLimit), premium: "Sınırsız" },
  { feature: "Belge sayısı", free: String(trialDocumentLimit), premium: "Sınırsız" },
  { feature: "Abonelik sayısı", free: String(trialSubscriptionLimit), premium: "Sınırsız" },
  { feature: "Fatura yükleme sayısı", free: String(trialInvoiceUploadLimit), premium: "Sınırsız" },
  { feature: "Bakım kurali", free: "Evet", premium: "Evet" },
  { feature: "Servis gecmisi", free: "Evet", premium: "Evet" },
  { feature: "PDF rapor export", free: "Hayir", premium: "Evet" },
  { feature: "Otomasyon (bildirim/email)", free: "Hayir", premium: "Evet" },
  { feature: "QR kod erisimi", free: "Evet", premium: "Evet" },
  { feature: "Oncelikli destek", free: "Hayir", premium: "Evet" },
];

const toTl = (amount: number) => `${new Intl.NumberFormat("tr-TR").format(amount)} TL`;

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const isAnnual = billingCycle === "annual";

  const startPremiumCheckout = useCallback(async () => {
    setIsStartingCheckout(true);

    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });

      if (!res.ok) {
        const responseText = await res.text();
        const errorMessage = responseText || "Stripe checkout baslatilamadi.";
        console.error("Checkout error:", res.status, errorMessage);
        alert(errorMessage);
        setIsStartingCheckout(false);
        return;
      }

      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!data?.url) {
        const missingUrlError = "Checkout URL donmedi.";
        console.error("Checkout error:", missingUrlError);
        alert(missingUrlError);
        setIsStartingCheckout(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      const networkError = "Stripe URL alinamadi.";
      console.error("Checkout error:", error);
      alert(networkError);
      setIsStartingCheckout(false);
    }
  }, []);

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
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Deneme ile basla, Premium ile olcekle</h1>
          <p className="mt-2 text-sm text-slate-300">
            Deneme: {trialAssetLimit} varlık, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik,{" "}
            {trialInvoiceUploadLimit} fatura yükleme.
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
            <p className="mt-3 text-sm font-medium text-emerald-200">{`1.788 TL -> 1.490 TL yillik %17 indirim`}</p>
          ) : null}
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="premium-card p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deneme</p>
            <p className="mt-3 text-4xl font-semibold text-white">0 TL</p>
            <p className="mt-1 text-sm text-slate-300">
              {trialAssetLimit} varlık, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik,{" "}
              {trialInvoiceUploadLimit} fatura yükleme
            </p>

            <ul className="mt-5 space-y-2 text-sm text-slate-200">
              <li>{`${trialAssetLimit} varlık limiti`}</li>
              <li>{`${trialDocumentLimit} belge limiti`}</li>
              <li>{`${trialSubscriptionLimit} abonelik limiti`}</li>
              <li>{`${trialInvoiceUploadLimit} fatura yükleme limiti`}</li>
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
              En çok Tercih Edilen
            </span>
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Premium</p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {isAnnual ? toTl(ANNUAL_DISCOUNTED_PRICE) : `${toTl(MONTHLY_PREMIUM_PRICE)}`}
            </p>
            <p className="mt-1 text-sm text-slate-200">{isAnnual ? "Yıllık Ödeme" : "Aylık Ödeme"}</p>
            {isAnnual ? (
              <p className="mt-2 text-xs text-emerald-200">{toTl(ANNUAL_REGULAR_PRICE)} yerine yillik avantajli fiyat</p>
            ) : null}

            <ul className="mt-5 space-y-2 text-sm text-slate-100">
              <li>Sınırsız varlık</li>
              <li>Sınırsız belge</li>
              <li>Sınırsız abonelik/fatura</li>
              <li>PDF rapor export + otomasyon</li>
            </ul>

            <button
              type="button"
              onClick={() => void startPremiumCheckout()}
              disabled={isStartingCheckout}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-[0_0_22px_rgba(99,102,241,0.5)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isStartingCheckout ? "Yonlendiriliyor..." : "Premium'u Baslat"}
            </button>
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
                  <th className="px-5 py-3 font-medium">Deneme</th>
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
