"use client"

import { useInView } from "@/modules/landing-v2/hooks/use-in-view"
import { CreditCard, RefreshCw, PauseCircle, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"

const subscriptions = [
  { name: "Proje Yönetim Aracı", plan: "Pro · 12 kullanıcı", amount: 2880, cycle: "Aylık", status: "active", color: "bg-chart-5/20 text-chart-5" },
  { name: "Tasarım Platformu", plan: "Takım Planı · 4 editör", amount: 2400, cycle: "Aylık", status: "active", color: "bg-primary/20 text-primary" },
  { name: "Bulut Barındırma", plan: "Kullanım bazlı", amount: 3450, cycle: "Aylık", status: "active", color: "bg-chart-3/20 text-chart-3" },
  { name: "E-posta Servisi", plan: "Business · 18 kullanıcı", amount: 1440, cycle: "Aylık", status: "active", color: "bg-chart-4/20 text-chart-4" },
  { name: "Analiz Aracı", plan: "Pro Plan", amount: 1920, cycle: "Aylık", status: "active", color: "bg-chart-2/20 text-chart-2" },
  { name: "Veritabanı Barındırma", plan: "Kullanım bazlı", amount: 890, cycle: "Aylık", status: "paused", color: "bg-chart-1/20 text-chart-1" },
]

export function AbonelikSection() {
  const { ref, inView } = useInView()
  const currencyFormatter = new Intl.NumberFormat("tr-TR")

  return (
    <section id="abonelik" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute top-1/2 left-0 z-0 hidden h-96 w-96 rounded-full bg-primary/5 blur-[150px] sm:block" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left - Demo Card */}
          <div className={`order-2 lg:order-1 ${inView ? "animate-slide-up" : "opacity-0"}`}>
            <div className="glass-card rounded-3xl p-4 sm:p-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-2 mb-6 sm:gap-3">
                <div className="rounded-xl bg-secondary/50 p-3 text-center sm:p-4">
                  <div className="text-lg font-bold text-foreground sm:text-2xl">14</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Aktif Abonelik</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center sm:p-4">
                  <div className="text-sm font-bold text-primary sm:text-2xl">{"12.980"}<span className="text-[10px] font-normal text-muted-foreground ml-0.5 sm:text-sm">{"TL"}</span></div>
                  <div className="text-[10px] text-muted-foreground mt-1">Aylık Gider</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center sm:p-4">
                  <div className="flex items-center justify-center gap-1">
                    <ArrowDownRight className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
                    <span className="text-lg font-bold text-primary sm:text-2xl">12%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Tespit Edilen Tasarruf</div>
                </div>
              </div>

              {/* Subscription List */}
              <div className="flex flex-col gap-2">
                {subscriptions.map((sub, i) => (
                  <div
                    key={i}
                    className="group flex items-center justify-between rounded-xl bg-secondary/30 p-3 transition-all hover:bg-secondary/50 hover:scale-[1.01] sm:p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sub.color.split(" ")[0]} font-bold text-sm ${sub.color.split(" ")[1]}`}>
                        {sub.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{sub.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{sub.plan} - {sub.cycle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-foreground">{currencyFormatter.format(sub.amount)} TL</div>
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
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-5xl text-balance">
              Tekrarlayan abonelikler{" "}
              <span className="text-gradient">tek ekranda</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              Tekrarlayan abonelikleri ve düzenli giderleri takip edin. Yenileme tarihlerini, ödeme periyotlarını ve kullanım durumlarını tek yerden görün.
            </p>

            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: CreditCard, label: "Otomatik Takip", desc: "Yenileme tarihleri ve kullanım bilgileri otomatik izlenir" },
                { icon: TrendingUp, label: "Harcama Analizi", desc: "Abonelik ve gider trendlerini anlık görün" },
                { icon: ArrowUpRight, label: "Tasarruf Tespiti", desc: "Kullanılmayan kalemleri bulun, aylık tasarrufu görün" },
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
