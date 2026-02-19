"use client"

import { useInView } from "@/modules/landing-v2/hooks/use-in-view"
import { CreditCard, RefreshCw, PauseCircle, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"

const subscriptions = [
  { name: "Netflix", plan: "Premium", amount: "239", cycle: "Aylık", status: "active", color: "bg-chart-5/20 text-chart-5" },
  { name: "Spotify", plan: "Aile", amount: "59", cycle: "Aylık", status: "active", color: "bg-primary/20 text-primary" },
  { name: "Adobe CC", plan: "Tüm Uygulamalar", amount: "1.199", cycle: "Yıllık", status: "active", color: "bg-chart-3/20 text-chart-3" },
  { name: "iCloud", plan: "200GB", amount: "49", cycle: "Aylık", status: "paused", color: "bg-chart-4/20 text-chart-4" },
]

export function AbonelikSection() {
  const { ref, inView } = useInView()

  return (
    <section id="abonelik" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute top-1/2 left-0 z-0 h-96 w-96 rounded-full bg-primary/5 blur-[150px]" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left - Demo Card */}
          <div className={`order-2 lg:order-1 ${inView ? "animate-slide-up" : "opacity-0"}`}>
            <div className="glass-card rounded-3xl p-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl bg-secondary/50 p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">7</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Aktif Abonelik</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{"1.845"}<span className="text-sm font-normal text-muted-foreground ml-0.5">{"TL"}</span></div>
                  <div className="text-[10px] text-muted-foreground mt-1">Aylık Toplam</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <ArrowDownRight className="h-4 w-4 text-primary" />
                    <span className="text-2xl font-bold text-primary">12%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Geçen Aya Göre</div>
                </div>
              </div>

              {/* Subscription List */}
              <div className="flex flex-col gap-2">
                {subscriptions.map((sub, i) => (
                  <div
                    key={i}
                    className="group flex items-center justify-between rounded-xl bg-secondary/30 p-4 transition-all hover:bg-secondary/50 hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${sub.color.split(" ")[0]} font-bold text-sm ${sub.color.split(" ")[1]}`}>
                        {sub.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{sub.name}</div>
                        <div className="text-xs text-muted-foreground">{sub.plan} - {sub.cycle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">{sub.amount} TL</div>
                        <div className={`text-[10px] ${sub.status === "active" ? "text-primary" : "text-chart-4"}`}>
                          {sub.status === "active" ? "Aktif" : "Duraklatıldı"}
                        </div>
                      </div>
                      {sub.status === "active" ? (
                        <RefreshCw className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <PauseCircle className="h-4 w-4 text-chart-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Content */}
          <div className={`order-1 lg:order-2 ${inView ? "animate-slide-in-left" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
              <CreditCard className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs tracking-widest text-primary">Abonelik Takibi</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
              Tüm abonelikleriniz{" "}
              <span className="text-gradient">kontrol altında</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Netflix, Spotify, bulut hizmetleri ve daha fazlası. Tüm dijital ve fiziksel aboneliklerinizi tek panelden yönetin, gereksiz harcamaları tespit edin.
            </p>

            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: CreditCard, label: "Otomatik Takip", desc: "Aylık ve yıllık abonelikler otomatik hesaplanır" },
                { icon: TrendingUp, label: "Harcama Analizi", desc: "Abonelik bazlı maliyet trendlerini görün" },
                { icon: ArrowUpRight, label: "Tasarruf Önerileri", desc: "Gereksiz abonelikleri tespit edip iptal edin" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 rounded-xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-primary/20 hover:bg-secondary/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" />
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
