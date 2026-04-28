"use client"

import { useInView } from "@/modules/landing-v2/hooks/use-in-view"
import { Receipt, FileCheck, Clock, AlertCircle, CheckCircle2, Filter, Download } from "lucide-react"

const invoices = [
  { no: "INV-2026-0142", provider: "Bulut Barındırma", amount: "3.450,00", vade: "25 Şub 2026", status: "pending", statusText: "Bekliyor" },
  { no: "INV-2026-0138", provider: "Veritabanı Barındırma", amount: "1.280,00", vade: "20 Şub 2026", status: "overdue", statusText: "Gecikti" },
  { no: "INV-2026-0135", provider: "Proje Yönetim Aracı", amount: "2.880,00", vade: "15 Şub 2026", status: "paid", statusText: "Ödendi" },
  { no: "INV-2026-0130", provider: "E-posta Servisi", amount: "1.440,00", vade: "10 Şub 2026", status: "paid", statusText: "Ödendi" },
]

const statusStyles: Record<string, string> = {
  pending: "bg-chart-4/10 text-chart-4",
  overdue: "bg-chart-5/10 text-chart-5",
  paid: "bg-primary/10 text-primary",
}

export function FaturaSection() {
  const { ref, inView } = useInView()

  return (
    <section id="fatura" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute bottom-1/3 right-0 z-0 hidden h-80 w-80 rounded-full bg-accent/5 blur-[120px] sm:block" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Left - Content */}
          <div className={inView ? "animate-slide-in-left" : "opacity-0"}>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 mb-6">
              <Receipt className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs tracking-widest text-accent">SaaS Faturaları</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl text-balance">
              SaaS faturalarınız{" "}
              <span className="text-gradient">tek ekranda</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              Tüm SaaS faturalarınızı tek ekranda görün. Vade tarihleri, ödeme durumları ve aylık toplam gideri anlık takip edin.
            </p>

            <div className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4">
              {[
                { icon: Receipt, label: "Fatura Kaydı", desc: "Tutar, vergi, vade ve SaaS aracı bazında" },
                { icon: FileCheck, label: "Belge Saklama", desc: "Fatura ve sözleşmeleri güvenle saklayın" },
                { icon: Clock, label: "Vade Takibi", desc: "Ödeme günü geldiğinde otomatik uyarı" },
                { icon: Download, label: "PDF Maliyet Raporu", desc: "Aylık SaaS gider özetini indirin" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-accent/20 hover:bg-secondary/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <item.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Invoice Table Demo */}
          <div className={`${inView ? "animate-slide-up" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
            <div className="glass-card rounded-3xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm font-semibold text-foreground">SaaS Fatura Geçmişi</div>
                  <div className="text-xs text-muted-foreground">Şubat 2026</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors" aria-label="Filtrele">
                    <Filter className="h-4 w-4" />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors" aria-label="İndir">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 mb-4 sm:gap-3 sm:mb-6">
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-lg font-bold text-chart-5">1</div>
                  <div className="text-[10px] text-muted-foreground">Geciken</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-lg font-bold text-chart-4">1</div>
                  <div className="text-[10px] text-muted-foreground">Bekleyen</div>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3 text-center">
                  <div className="text-lg font-bold text-primary">2</div>
                  <div className="text-[10px] text-muted-foreground">Ödenen</div>
                </div>
              </div>

              {/* Invoice List */}
              <div className="flex flex-col gap-2">
                {invoices.map((inv, i) => (
                  <div
                    key={i}
                    className="group flex items-center justify-between gap-2 rounded-xl bg-secondary/30 p-3 transition-all hover:bg-secondary/50 hover:scale-[1.01] sm:gap-3 sm:p-4"
                  >
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${statusStyles[inv.status]}`}>
                        {inv.status === "paid" ? <CheckCircle2 className="h-4 w-4" /> :
                         inv.status === "overdue" ? <AlertCircle className="h-4 w-4" /> :
                         <Clock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{inv.provider}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{inv.no} - Vade: {inv.vade}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold text-foreground sm:text-sm">{inv.amount} TL</div>
                      <div className={`text-[10px] ${statusStyles[inv.status].split(" ")[1]}`}>{inv.statusText}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
