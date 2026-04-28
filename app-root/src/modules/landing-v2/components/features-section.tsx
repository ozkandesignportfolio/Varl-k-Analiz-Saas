"use client"

import type { ComponentType } from "react"
import { BarChart3, CreditCard, FileText, Package, Wrench } from "lucide-react"
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
    title: "Varlık ve Envanter Takibi",
    description: "Fiziksel ve dijital varlıklarınızı kayıt altına alın. Kategori, konum, sahiplik ve durum bilgisiyle envanterinizi düzenli tutun. Varlık kartlarından geçmiş, atamalar ve detaylara erişin.",
    tone: "primary-accent",
  },
  {
    icon: CreditCard,
    title: "Abonelik ve Gider Yönetimi",
    description: "Aktif aboneliklerinizi ve tekrarlayan giderlerinizi takip edin. Aylık ve yıllık maliyet dökümünü görün, yenileme tarihlerinde hatırlatma alın, kullanılmayan kalemleri tespit edin.",
    tone: "accent-chart3",
  },
  {
    icon: FileText,
    title: "Belge ve Kayıt Yönetimi",
    description: "Fatura, garanti belgesi, sözleşme ve servis raporlarını varlıklarla ilişkilendirerek saklayın. Güvenli depolama, erişim kontrolü ve hızlı arama ile belgelerinize anında ulaşın.",
    tone: "chart3-chart4",
  },
  {
    icon: Wrench,
    title: "Bakım ve Servis Takibi",
    description: "Periyodik bakım planları oluşturun, servis geçmişini kaydedin. Yaklaşan bakımlar ve garanti bitiş tarihleri için otomatik hatırlatma alın, servis maliyetlerini izleyin.",
    tone: "chart4-primary",
  },
  {
    icon: BarChart3,
    title: "Raporlama ve Analiz",
    description: "Maliyet dağılımını, bakım geçmişini ve varlık durumunu grafiklerle inceleyin. PDF raporlar oluşturun, belirlediğiniz eşiklerde otomatik bildirim alın.",
    tone: "primary-accent",
  },
]

export function FeaturesSection() {
  const { ref, inView } = useInView(0.1)

  return (
    <section id="ozellikler" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center sm:mb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">TEMEL ÖZELLİKLER</span>
          </div>
          <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl lg:text-5xl">
            Varlıklarınız ve operasyonlarınız, <span className="text-gradient">tek bir kontrol noktası</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Envanter, abonelik, belge, bakım ve maliyet takibi — düzenli ve görünür
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={i}
              data-tone={feature.tone}
              className={`landing-v2-feature-card glass-card group cursor-default rounded-2xl p-6 transition-all duration-500 ${
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
