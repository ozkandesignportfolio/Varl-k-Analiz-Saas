import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPlanConfig } from "@/lib/plans/plan-config"

const trialPlan = getPlanConfig("starter")
const trialAssetLimit = trialPlan.limits.assetsLimit ?? 0
const trialDocumentLimit = trialPlan.limits.documentsLimit ?? 0
const trialSubscriptionLimit = trialPlan.limits.subscriptionsLimit ?? 0
const trialInvoiceUploadLimit = trialPlan.limits.invoiceUploadsLimit ?? 0

export function CTASection() {
  return (
    <section className="relative isolate py-32">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="glass-card rounded-3xl p-12 sm:p-16 animate-pulse-glow">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-8">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs tracking-widest text-primary">Hemen Başlayın</span>
          </div>

          <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
            Varlıklarınızı kontrol altına
            <br />
            <span className="text-gradient">almaya hazır mısınız?</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Ücretsiz planla hemen başlayın. Kredi kartı gerekmez.
            Premium özelliklere istediğiniz zaman geçin.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="group bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 px-10 py-6 text-base"
            >
              Ücretsiz Hesap Oluştur
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border text-foreground hover:bg-secondary/50 px-8 py-6 text-base"
            >
              Demo Talep Et
            </Button>
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            {trialAssetLimit} varlık, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik,{" "}
            {trialInvoiceUploadLimit} fatura yükleme ile başlayın
          </p>
        </div>
      </div>
    </section>
  )
}
