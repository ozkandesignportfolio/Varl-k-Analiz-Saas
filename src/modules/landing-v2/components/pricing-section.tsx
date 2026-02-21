"use client"

import { Check, Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPlanConfig } from "@/lib/plans/plan-config"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

const trialPlan = getPlanConfig("starter")
const trialAssetLimit = trialPlan.limits.assetsLimit ?? 0
const trialDocumentLimit = trialPlan.limits.documentsLimit ?? 0
const trialSubscriptionLimit = trialPlan.limits.subscriptionsLimit ?? 0
const trialInvoiceUploadLimit = trialPlan.limits.invoiceUploadsLimit ?? 0

const plans = [
  {
    name: "Deneme",
    price: "0",
    period: "sonsuza dek",
    description: "Başlangıç seviyesi takip",
    features: [
      `${trialAssetLimit} varlık takibi`,
      `${trialDocumentLimit} belge yükleme`,
      `${trialSubscriptionLimit} abonelik takibi`,
      `${trialInvoiceUploadLimit} fatura yükleme`,
      "Temel dashboard ve bildirim",
    ],
    cta: "Ücretsiz Başla",
    popular: false,
  },
  {
    name: "Premium",
    price: "149",
    period: "/ay",
    description: "Varlıklarınızı profesyonel yönetin",
    features: [
      "Sınırsız varlık takibi",
      "Sınırsız belge yükleme",
      "Sınırsız abonelik ve fatura",
      "Skor analizi",
      "Gelişmiş bildirimler",
      "PDF raporlama",
      "QR/Barkod erişimi",
      "Otomasyon motoru",
      "Öncelikli destek",
    ],
    cta: "Premium Başla",
    popular: true,
  },
]

export function PricingSection() {
  const { ref, inView } = useInView()

  return (
    <section id="fiyatlandirma" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[150px]" />

      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs tracking-widest text-primary">Fiyatlandırma</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
            Basit ve <span className="text-gradient">şeffaf fiyatlandırma</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Deneme planı: {trialAssetLimit} varlık, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik,{" "}
            {trialInvoiceUploadLimit} fatura yükleme
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-3xl p-8 transition-all duration-500 ${
                inView ? "animate-slide-up" : "opacity-0"
              } ${plan.popular ? "glass-card border-primary/30 animate-pulse-glow" : "glass-card"}`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1">
                  <Sparkles className="h-3 w-3 text-primary-foreground" />
                  <span className="text-xs font-semibold text-primary-foreground">Önerilen</span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                <span className="text-lg text-muted-foreground">{plan.price === "0" ? "" : " TL"}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>

              <div className="mb-8 flex flex-col gap-3">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${plan.popular ? "bg-primary/20" : "bg-secondary"}`}>
                      <Check className={`h-3 w-3 ${plan.popular ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full py-6 text-base group ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                }`}
              >
                {plan.cta}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
