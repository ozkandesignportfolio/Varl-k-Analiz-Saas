"use client"

import type { ComponentType } from "react"
import { BarChart3, Bell, CreditCard, FileText, Package, Receipt, Shield, Smartphone, Users, Wrench } from "lucide-react"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

type FeatureTone = "primary-accent" | "accent-chart3" | "chart3-chart4" | "chart4-primary"

const features: Array<{
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  title: string
  description: string
  tone: FeatureTone
}> = [
  {
    icon: Package,
    title: "Varlık Envanteri",
    description: "Fiziksel ve dijital varlıkları kategori, konum, sahiplik ve durum bilgileriyle düzenli şekilde takip edin.",
    tone: "primary-accent",
  },
  {
    icon: CreditCard,
    title: "Abonelik Takibi",
    description: "Tekrarlayan abonelikleri, yenileme tarihlerini ve kullanım durumlarını tek yerden yönetin.",
    tone: "accent-chart3",
  },
  {
    icon: Receipt,
    title: "Fatura ve Giderler",
    description: "Faturaları, ödeme kayıtlarını ve aylık giderleri varlık veya aboneliklerle ilişkilendirin.",
    tone: "chart3-chart4",
  },
  {
    icon: FileText,
    title: "Belge Yönetimi",
    description: "Garanti belgeleri, sözleşmeler, servis raporları ve lisans kayıtlarını güvenli şekilde saklayın.",
    tone: "chart4-primary",
  },
  {
    icon: Wrench,
    title: "Bakım ve Servis",
    description: "Periyodik bakım tarihlerini, servis geçmişini ve yaklaşan işlemleri takip edin.",
    tone: "primary-accent",
  },
  {
    icon: Users,
    title: "Ekip Kullanımı",
    description: "Varlıkların ve aboneliklerin kim tarafından kullanıldığını görün, sorumlulukları netleştirin.",
    tone: "accent-chart3",
  },
  {
    icon: Bell,
    title: "Bildirimler",
    description: "Yenileme, bakım, garanti ve ödeme tarihleri için zamanında hatırlatmalar alın.",
    tone: "chart3-chart4",
  },
  {
    icon: BarChart3,
    title: "Raporlama",
    description: "Varlık, gider ve abonelik verilerini anlaşılır raporlar ve grafiklerle değerlendirin.",
    tone: "chart4-primary",
  },
  {
    icon: Shield,
    title: "Güvenli Erişim",
    description: "Ekip verilerini düzenli, kontrollü ve erişim kurallarına uygun şekilde yönetin.",
    tone: "primary-accent",
  },
  {
    icon: Smartphone,
    title: "Çoklu Cihaz",
    description: "Web, mobil ve tablet üzerinden kayıtlarınıza düzenli ve uyumlu şekilde erişin.",
    tone: "accent-chart3",
  },
]

export function FeaturesSection() {
  const { ref, inView } = useInView(0.1)

  return (
    <section id="ozellikler" className="relative isolate py-16 sm:py-24 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center sm:mb-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">TEMEL ÖZELLİKLER</span>
          </div>
          <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl lg:text-5xl">
            Varlık, abonelik ve gider yönetimi için{" "}
            <span className="text-gradient">temel araçlar</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Envanter, belge, bakım, fatura ve ekip kullanımını tek bir düzen içinde takip edin.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              data-tone={feature.tone}
              className={`landing-v2-feature-card glass-card group min-w-0 cursor-default rounded-2xl p-5 transition-all duration-500 sm:p-6 ${
                inView ? "animate-slide-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="landing-v2-feature-icon mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-all group-hover:-translate-y-0.5 group-hover:scale-105">
                <feature.icon aria-hidden className="landing-v2-feature-icon-glyph h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
