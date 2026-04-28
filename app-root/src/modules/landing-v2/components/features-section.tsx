"use client"

import type { ComponentType } from "react"
import { BarChart3, Bell, Clock, FileText, Lock, QrCode, Shield, Smartphone, Wrench, Zap } from "lucide-react"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

type FeatureTone = "primary-accent" | "accent-chart3" | "chart3-chart4" | "chart4-primary"

const features: Array<{
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  title: string
  description: string
  tone: FeatureTone
}> = [
  {
    icon: Shield,
    title: "Merkezi yazılım envanteri",
    description: "Ekibinizin kullandığı tüm araçları tek bir listede toplayın. Kategori, sahiplik ve durum bilgisiyle düzenli tutun.",
    tone: "primary-accent",
  },
  {
    icon: Wrench,
    title: "Kullanılmayan araç tespiti",
    description: "Aktif kullanılmayan veya birbirine benzer araçları belirleyin. Gereksiz harcamayı somut veriye dayalı olarak azaltın.",
    tone: "accent-chart3",
  },
  {
    icon: FileText,
    title: "Kullanıcı-araç eşleştirmesi",
    description: "Hangi ekip üyesinin hangi araca atandığını görün. Lisans dağılımını net şekilde takip edin.",
    tone: "chart3-chart4",
  },
  {
    icon: BarChart3,
    title: "Maliyet analizi ve dökümü",
    description: "Aylık ve yıllık yazılım harcamalarınızı grafiklerle görün. Kategori ve araç bazında maliyet dağılımını inceleyin.",
    tone: "chart4-primary",
  },
  {
    icon: Bell,
    title: "Yenileme ve fatura takibi",
    description: "Abonelik yenileme tarihlerini ve fatura döngülerini izleyin. Yaklaşan ödemeler için otomatik hatırlatma alın.",
    tone: "primary-accent",
  },
  {
    icon: Clock,
    title: "Donanım ve garanti kaydı",
    description: "Fiziksel varlıkları da sisteme ekleyin. Garanti süresi, servis geçmişi ve atanan kullanıcıları kayıt altında tutun.",
    tone: "accent-chart3",
  },
  {
    icon: QrCode,
    title: "Hızlı arama ve filtreleme",
    description: "Araç adı, kategori veya ekip üyesine göre filtreleyin. Aradığınız kaydı saniyeler içinde bulun.",
    tone: "chart3-chart4",
  },
  {
    icon: Zap,
    title: "Otomatik raporlar ve uyarılar",
    description: "Aylık maliyet raporlarını PDF olarak oluşturun. Belirlediğiniz eşiklerde otomatik bildirim alın.",
    tone: "chart4-primary",
  },
  {
    icon: Lock,
    title: "Veri izolasyonu ve güvenlik",
    description: "Her ekibin verileri birbirinden tamamen ayrıdır. Şifreli bağlantı ve özel depolama alanı standart olarak sağlanır.",
    tone: "primary-accent",
  },
  {
    icon: Smartphone,
    title: "Web ve mobil erişim",
    description: "Masaüstü, tablet veya telefon — tüm cihazlarınızdan aynı deneyimle çalışın.",
    tone: "accent-chart3",
  },
]

export function FeaturesSection() {
  const { ref, inView } = useInView(0.1)

  return (
    <section id="ozellikler" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center sm:mb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">TEMEL ÖZELLİKLER</span>
          </div>
          <h2 className="text-balance text-2xl font-bold text-foreground sm:text-3xl lg:text-5xl">
            Tüm yazılım varlıklarınız, <span className="text-gradient">tek bir kontrol noktası</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            Envanter, abonelik takibi, maliyet analizi ve ekip yönetimi — tek bir yerden
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5">
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
