"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { ArrowRight, FileText, Play, Shield, TrendingUp, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start = 0
    const duration = 2000
    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = Math.floor(eased * target)
      if (el) el.textContent = start.toLocaleString("tr-TR") + suffix
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [target, suffix])

  return <span ref={ref}>0{suffix}</span>
}

export function HeroSection() {
  return (
    <section className="relative isolate flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-visible pt-20">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />

      <div aria-hidden="true" className="landing-v2-hero-motion pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="landing-v2-hero-motion-plane">
          <span className="landing-v2-hero-blob landing-v2-hero-blob-a" />
          <span className="landing-v2-hero-blob landing-v2-hero-blob-b" />
          <span className="landing-v2-hero-blob landing-v2-hero-blob-c" />
        </div>
      </div>

      <div className="pointer-events-none absolute top-1/4 left-1/4 -z-10 h-96 w-96 rounded-full bg-primary/5 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 -z-10 h-80 w-80 rounded-full bg-accent/5 blur-[100px]" />

      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 opacity-[0.15]">
        <div className="animate-orbit absolute">
          <div className="h-3 w-3 rounded-full bg-primary" />
        </div>
        <div className="animate-orbit absolute" style={{ animationDelay: "-7s" }}>
          <div className="h-2 w-2 rounded-full bg-accent" />
        </div>
        <div className="animate-orbit absolute" style={{ animationDelay: "-14s" }}>
          <div className="h-2.5 w-2.5 rounded-full bg-chart-3" />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        <div className="animate-slide-up mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-sm text-primary">Yeni: Skor Analizi ve Fatura Takip</span>
        </div>

        <h1
          className="animate-slide-up text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="text-balance">
            Varlıklarınızı <span className="text-gradient">akıllı</span>
            <br className="hidden sm:block" /> yönetin, riskleri <span className="text-gradient">önleyin</span>
          </span>
        </h1>

        <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl" style={{ animationDelay: "0.2s" }}>
          Bakım, garanti, servis ve belge süreçlerinizi tek panelde takip edin. Akıllı bildirimler, abonelik yönetimi
          ve skor analizi ile her zaman kontrolde kalın.
        </p>

        <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.3s" }}>
          <Button
            asChild
            size="lg"
            className="group bg-primary px-8 py-6 text-base text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90 focus-visible:ring-primary/70"
          >
            <Link href="/register">
              Ücretsiz Başla
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-border px-8 py-6 text-base text-foreground hover:bg-secondary/50 focus-visible:ring-primary/60"
          >
            <Play className="mr-2 h-4 w-4" />
            Demo İzle
          </Button>
        </div>

        <div className="animate-slide-up mt-20 grid grid-cols-2 gap-6 sm:grid-cols-4" style={{ animationDelay: "0.5s" }}>
          {[
            { icon: Shield, value: 12500, suffix: "+", label: "Aktif Kullanıcı" },
            { icon: Wrench, value: 45000, suffix: "+", label: "Takip Edilen Varlık" },
            { icon: FileText, value: 98, suffix: "%", label: "Memnuniyet Oranı" },
            { icon: TrendingUp, value: 340, suffix: "K", label: "İşlem Tamamlandı" },
          ].map((stat, i) => (
            <div key={i} className="glass-card group rounded-2xl p-6 transition-all duration-300 hover:scale-105">
              <stat.icon className="mx-auto mb-3 h-6 w-6 text-primary opacity-80 transition-opacity group-hover:opacity-100" />
              <div className="animate-count-up text-2xl font-bold text-foreground sm:text-3xl">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </section>
  )
}
