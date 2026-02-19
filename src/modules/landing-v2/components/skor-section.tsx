"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { BarChart3, TrendingUp, Award, Target, ChevronUp, Shield, Wrench, FileText, CreditCard } from "lucide-react"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

function AnimatedCircularScore({ score, inView }: { score: number; inView: boolean }) {
  const [currentScore, setCurrentScore] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawCircle = useCallback((value: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 200
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const center = size / 2
    const radius = 80
    const lineWidth = 10

    ctx.clearRect(0, 0, size, size)

    // Background circle
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, 2 * Math.PI)
    ctx.strokeStyle = "rgba(26, 42, 74, 0.5)"
    ctx.lineWidth = lineWidth
    ctx.stroke()

    // Score arc
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + (2 * Math.PI * value) / 100
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, "#06d6a0")
    gradient.addColorStop(1, "#0ff0fc")

    ctx.beginPath()
    ctx.arc(center, center, radius, startAngle, endAngle)
    ctx.strokeStyle = gradient
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.stroke()

    // Glow
    ctx.beginPath()
    ctx.arc(center, center, radius, startAngle, endAngle)
    ctx.strokeStyle = "rgba(6, 214, 160, 0.2)"
    ctx.lineWidth = lineWidth + 8
    ctx.lineCap = "round"
    ctx.stroke()
  }, [])

  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 2000
    const startTime = performance.now()

    function animate(time: number) {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      start = Math.floor(eased * score)
      setCurrentScore(start)
      drawCircle(start)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [inView, score, drawCircle])

  return (
    <div className="relative flex items-center justify-center">
      <canvas ref={canvasRef} className="h-[200px] w-[200px]" />
      <div className="absolute flex flex-col items-center">
        <div className="text-4xl font-bold text-foreground">{currentScore}</div>
        <div className="text-xs text-primary font-medium">/ 100</div>
      </div>
    </div>
  )
}

const scoreCategories = [
  { icon: Shield, label: "Garanti Durumu", score: 92, color: "bg-primary" },
  { icon: Wrench, label: "Bakım Uyumu", score: 78, color: "bg-accent" },
  { icon: FileText, label: "Belge Tamlığı", score: 85, color: "bg-chart-3" },
  { icon: CreditCard, label: "Ödeme Durumu", score: 96, color: "bg-chart-4" },
]

export function SkorSection() {
  const { ref, inView } = useInView()

  return (
    <section id="skor" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[150px]" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left - Score Demo */}
          <div className={`order-2 lg:order-1 ${inView ? "animate-slide-up" : "opacity-0"}`}>
            <div className="glass-card rounded-3xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="text-sm font-semibold text-foreground">Varlık Sağlık Skoru</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ChevronUp className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs text-primary">+5 puan geçen aya göre</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="flex justify-center mb-8">
                <AnimatedCircularScore score={87} inView={inView} />
              </div>

              {/* Category Breakdown */}
              <div className="flex flex-col gap-3">
                {scoreCategories.map((cat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/50">
                      <cat.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{cat.label}</span>
                        <span className="text-xs font-semibold text-foreground">{cat.score}/100</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cat.color} transition-all duration-1000 ease-out`}
                          style={{ width: inView ? `${cat.score}%` : "0%" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Content */}
          <div className={`order-1 lg:order-2 ${inView ? "animate-slide-in-left" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-chart-3/20 bg-chart-3/5 px-4 py-1.5 mb-6">
              <BarChart3 className="h-3.5 w-3.5 text-chart-3" />
              <span className="text-xs tracking-widest text-chart-3">Skor Analizi</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
              Varlık sağlığınızı{" "}
              <span className="text-gradient">ölçümleyin</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Her varlığınızın garanti, bakım, belge ve ödeme durumunu birleşik bir skor ile ölçün. Zayıf noktaları hızla tespit edin, aksiyon alın.
            </p>

            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: BarChart3, label: "Birleşik Skor", desc: "4 farklı kategoriden hesaplanan genel sağlık puanı" },
                { icon: TrendingUp, label: "Trend Takibi", desc: "Aylık skor değişimlerini grafikle izleyin" },
                { icon: Target, label: "Aksiyon Önerileri", desc: "Skor artırmak için otomatik tavsiyeler" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 rounded-xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-chart-3/20 hover:bg-secondary/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-3/10">
                    <item.icon className="h-5 w-5 text-chart-3" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
