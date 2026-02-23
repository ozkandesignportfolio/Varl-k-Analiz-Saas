"use client"

import { useInView } from "@/modules/landing-v2/hooks/use-in-view"
import { Shield, Wrench, TrendingUp, FileText, Bell, CreditCard, BarChart3, Receipt, Clock, Settings, LayoutDashboard, Box, Folder, DollarSign } from "lucide-react"

const sidebarItems = [
  { icon: LayoutDashboard, label: "Gösterge", badge: "GS", active: true },
  { icon: Box, label: "Varlıklar", badge: "VR" },
  { icon: Wrench, label: "Bakım", badge: "BK" },
  { icon: Settings, label: "Servisler", badge: "SR" },
  { icon: Folder, label: "Belgeler", badge: "BG" },
  { icon: Clock, label: "Zaman Akışı", badge: "ZA" },
  { icon: DollarSign, label: "Giderler", badge: "GD" },
  { icon: Bell, label: "Bildirimler", badge: "BL" },
  { icon: CreditCard, label: "Abonelikler", badge: "AB" },
  { icon: Receipt, label: "Fatura Takip", badge: "FT" },
  { icon: BarChart3, label: "Skor Analizi", badge: "SK" },
  { icon: FileText, label: "Raporlar", badge: "RP" },
  { icon: Settings, label: "Ayarlar", badge: "AY" },
]

const RISK_RECORD_COUNT_LABEL = "0 kayit"

export function DashboardPreview() {
  const { ref, inView } = useInView(0.1)

  return (
    <section id="panel" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
            <span className="text-xs tracking-widest text-primary">Premium Panel</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
            Güçlü kontrol paneli,{" "}
            <span className="text-gradient">tek bakışta</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Bildirim, Abonelik, Fatura Takip ve Skor Analizi dahil tüm modüller tek panelde
          </p>
        </div>

        <div className={`${inView ? "animate-slide-up" : "opacity-0"}`}>
          {/* Dashboard Mockup */}
          <div className="glass-card rounded-3xl overflow-hidden border border-border/30 animate-pulse-glow">
            <div className="flex">
              {/* Sidebar */}
              <div className="hidden w-56 shrink-0 border-r border-border/30 bg-[#070e20] p-4 md:block">
                <div className="flex items-center gap-3 mb-8 px-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <Shield className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold tracking-tight text-foreground">ASSETCARE</div>
                    <div className="text-[9px] text-muted-foreground">Premium Panel</div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {sidebarItems.map((item, i) => (
                    <div
                      key={i}
                      className={`group flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                        item.active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground/50">{item.badge}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-6">
                <div className="mb-6">
                  <div className="inline-flex items-center rounded-lg bg-secondary/50 px-3 py-1.5 text-[10px] tracking-widest text-primary mb-2">
                    Kontrol Merkezi
                  </div>
                  <div className="text-xs text-muted-foreground">19 Şubat 2026, Perşembe</div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
                  {[
                    { label: "TOPLAM VARLIK", value: "8", sub: "Stabil", icon: Box },
                    { label: "AKTİF BAKIM KURALI", value: "12", sub: "+2 bu ay", icon: Wrench },
                    { label: "TOPLAM SERVİS MALİYETİ", value: "4.850 TL", sub: "-15% geçen aya göre", icon: TrendingUp, subColor: "text-primary" },
                    { label: "SAĞLIK SKORU", value: "87/100", sub: "+5 puan", icon: BarChart3, subColor: "text-primary" },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl bg-secondary/30 border border-border/30 p-4 transition-all hover:border-primary/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] tracking-widest text-muted-foreground">{stat.label}</span>
                        <stat.icon className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                      <div className="text-xl font-bold text-foreground">{stat.value}</div>
                      <div className={`text-[10px] mt-1 ${stat.subColor || "text-muted-foreground"}`}>{stat.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Risk Panel */}
                <div className="rounded-xl bg-secondary/20 border border-border/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-chart-4">{"!"}</span>
                      <span className="text-sm font-semibold text-foreground">Risk Paneli</span>
                    </div>
                    <span suppressHydrationWarning className="text-[10px] text-muted-foreground">
                      {RISK_RECORD_COUNT_LABEL}
                    </span>
                  </div>
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-xs text-primary flex items-center gap-2">
                    <span>{"Tüm varlıklar kontrol altında"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
