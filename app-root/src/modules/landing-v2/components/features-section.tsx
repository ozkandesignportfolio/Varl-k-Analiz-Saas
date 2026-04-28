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
    title: "SaaS envanterinizin net resmini görün",
    description: "Ekibinizin kullandığı her SaaS aracını takip edin — Slack, Notion, Figma, AWS — hepsi tek, düzenli bir görünümde.",
    tone: "primary-accent",
  },
  {
    icon: Wrench,
    title: "Kullanılmayan ve mükerrer araçları tespit edin",
    description: "Kimsenin kullanmadığı araçları ve çakışan abonelikleri anında bulun. İhtiyacınız olmayana para ödemeyi bırakın.",
    tone: "accent-chart3",
  },
  {
    icon: FileText,
    title: "Kimin neyi kullandığını bilin",
    description: "Her aboneliğe hangi ekip üyelerinin atandığını tam olarak bilin. Artık tahmin yok.",
    tone: "chart3-chart4",
  },
  {
    icon: BarChart3,
    title: "Yazılım harcamalarınızı anlayın",
    description: "Toplam aylık SaaS maliyetlerinizi bir bakışta görün. Her kuruşun nereye gittiğini net grafikler ve dökümlerle bilin.",
    tone: "chart4-primary",
  },
  {
    icon: Bell,
    title: "Fatura ve ödemelerin üstünde kalın",
    description: "Her faturayı, gideri ve yenileme tarihini takip edin. Ücretler kesilmeden önce uyarı alın, hiçbir şey gözden kaçmasın.",
    tone: "primary-accent",
  },
  {
    icon: Clock,
    title: "Ekipman maliyetlerini ve garantileri takip edin",
    description: "Dizüstü bilgisayar ve yönlendirici gibi donanımları SaaS ile birlikte izleyin. Garantileri, servis geçmişini ve atanan kullanıcıları takip edin.",
    tone: "accent-chart3",
  },
  {
    icon: QrCode,
    title: "Herhangi bir aboneliği saniyeler içinde bulun",
    description: "Araç adı, kategori veya ekip üyesine göre filtreleyin. Güçlü arama ile herhangi bir aboneliği anında bulun.",
    tone: "chart3-chart4",
  },
  {
    icon: Zap,
    title: "Uyarıları ve maliyet raporlarını otomatikleştirin",
    description: "Yenileme hatırlatmaları, kullanılmayan araç uyarıları ve aylık PDF maliyet raporları — hepsi otomatik.",
    tone: "chart4-primary",
  },
  {
    icon: Lock,
    title: "Kurumsal düzeyde güvenlik",
    description: "Ekip verileri tamamen izole edilmiştir. Şifreli iletişim ve özel depolama bilgilerinizi güvende tutar.",
    tone: "primary-accent",
  },
  {
    icon: Smartphone,
    title: "Her cihazdan erişin",
    description: "Toplantıda, yolda veya masanızda — her cihazda aynı güçlü deneyim.",
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
            <span className="text-xs tracking-widest text-primary">NELER YAPABİLİRSİNİZ</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            SaaS maliyetlerinizi <span className="text-gradient">kontrol altına alan</span> tek platform
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Abonelik takibinden maliyet analizine — SaaS israfını azaltın ve daha akıllı yazılım kararları verin
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
