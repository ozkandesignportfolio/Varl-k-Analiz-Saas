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
    title: "Varlık Yönetimi",
    description: "Tüm ev ve kişisel varlıklarınızı tek panelde takip edin. Kategorize edin, detaylandırın.",
    tone: "primary-accent",
  },
  {
    icon: Wrench,
    title: "Bakım Motoru",
    description: "Otomatik bakım periyotları, akıllı hatırlatmalar ve gecikme uyarıları ile riskleri önleyin.",
    tone: "accent-chart3",
  },
  {
    icon: FileText,
    title: "Belge Kasası",
    description: "Garanti belgeleri, faturalar ve servis formlarını güvenli şekilde saklayın.",
    tone: "chart3-chart4",
  },
  {
    icon: BarChart3,
    title: "Maliyet Analizi",
    description: "Servis harcamalarınızı grafiklerle takip edin, kategori bazlı dağılımı görün.",
    tone: "chart4-primary",
  },
  {
    icon: Bell,
    title: "Akıllı Bildirimler",
    description: "Garanti bitişi, bakım zamanı ve fatura vadesi yaklaştığında anında haberdar olun.",
    tone: "primary-accent",
  },
  {
    icon: Clock,
    title: "Zaman Akışı",
    description: "Tüm olayları kronolojik sırada görün. Servisler, yüklemeler ve değişiklikler tek yerde.",
    tone: "accent-chart3",
  },
  {
    icon: QrCode,
    title: "QR Kod Erişimi",
    description: "QR/Barkod tarayarak varlık detaylarına anında ulaşın. Hızlı ve pratik.",
    tone: "chart3-chart4",
  },
  {
    icon: Zap,
    title: "Otomasyon",
    description: "Tetikleyici olaylara bağlı otomatik işlemler: email, bildirim, PDF rapor.",
    tone: "chart4-primary",
  },
  {
    icon: Lock,
    title: "Güvenlik",
    description: "RLS ile veri izolasyonu, private storage ve HTTPS ile tam güvenlik.",
    tone: "primary-accent",
  },
  {
    icon: Smartphone,
    title: "Mobil Uyumlu",
    description: "Her cihazda mükemmel deneyim. PWA desteği ile masaüstüne kurun.",
    tone: "accent-chart3",
  },
]

export function FeaturesSection() {
  const { ref, inView } = useInView(0.1)

  return (
    <section id="ozellikler" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <span className="text-xs tracking-widest text-primary">Özellikler</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            İhtiyacınız olan her şey, <span className="text-gradient">tek platformda</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            AssetCare ile varlık yönetiminin tüm boyutlarını kontrol altına alın
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
