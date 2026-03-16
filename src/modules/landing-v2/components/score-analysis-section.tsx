"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { ArrowRight, BarChart3, ChevronDown, ChevronUp, Sparkles, TrendingUp } from "lucide-react";
import "@/components/kpi/chartjs-setup";
import { Button } from "@/components/ui/button";
import {
  costEfficiencyRatio,
  exampleAsset,
  scoreBreakdown,
  scoreTrend,
} from "@/modules/landing-v2/data/score-analysis-demo";
import { useInView } from "@/modules/landing-v2/hooks/use-in-view";

const tlFormatter = new Intl.NumberFormat("tr-TR");

function BreakdownBar({ label, score, toneClass }: { label: string; score: number; toneClass: string }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const width = safeScore > 0 ? Math.max(4, safeScore) : 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/70">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground">{safeScore}/100</span>
    </div>
  );
}

export function ScoreAnalysisSection() {
  const { ref, inView } = useInView();
  const [showFormula, setShowFormula] = useState(false);

  const trendData = useMemo<ChartData<"line">>(
    () => ({
      labels: scoreTrend.map((point) => point.month),
      datasets: [
        {
          label: "Skor",
          data: scoreTrend.map((point) => point.score),
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34, 211, 238, 0.16)",
          pointBackgroundColor: "#67e8f9",
          pointBorderColor: "#67e8f9",
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.34,
        },
      ],
    }),
    [],
  );

  const trendOptions = useMemo<ChartOptions<"line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          borderColor: "rgba(103, 232, 249, 0.35)",
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: (context) => `Skor: ${Number(context.parsed.y ?? 0)}/100`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.08)",
          },
        },
        y: {
          min: 70,
          max: 85,
          ticks: {
            stepSize: 5,
            color: "#94a3b8",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.12)",
          },
        },
      },
    }),
    [],
  );

  return (
    <section id="skor-analizi" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-3/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-chart-3/20 bg-chart-3/5 px-4 py-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-chart-3" />
          <span className="text-xs tracking-widest text-chart-3">Skor Analizi</span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={`min-w-0 w-full ${inView ? "animate-slide-up" : "opacity-0"}`}>
            <div className="glass-card min-w-0 w-full rounded-3xl border border-border/60 bg-background/70 p-8 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.85)]">
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">Skor nasıl hesaplanır?</h2>
              <p className="mt-2 text-base font-medium text-chart-3">3 adımda net bir puan</p>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Varlığınızın sağlık durumunu tek puanda topluyoruz. Karmaşık oranlar yerine, günlük kullanımda karar vermeyi
                hızlandıran net bir özet sunuyoruz.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Puan yükseldikçe risk azalır, bakım ve belge süreci daha öngörülebilir hale gelir.
              </p>

              <ol className="mt-6 space-y-3 text-sm text-foreground">
                <li className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">
                  1) Garanti: Aktifse +, bitiyorsa uyarı, bittiyse eksi
                </li>
                <li className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">
                  2) Bakım: Zamanında yapılan bakım +, geciken bakım eksi
                </li>
                <li className="rounded-xl border border-border/50 bg-secondary/30 px-4 py-3">
                  3) Belgeler ve Ödemeler: Eksiksiz belge ve ödeme +, eksikler eksi
                </li>
              </ol>

              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-chart-3 transition-colors hover:text-chart-2"
                onClick={() => setShowFormula((prev) => !prev)}
              >
                Detaylı hesaplama
                {showFormula ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showFormula ? (
                <div className="mt-3 rounded-xl border border-chart-3/25 bg-chart-3/5 p-4 text-xs leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Skor = (Garanti + Bakım + Belge + Ödeme) ortalaması + maliyet verimliliği bonusu
                  </p>
                  <p className="mt-2">Maliyet verimliliği bonusu: Varlık Değeri / (Toplam Bakım+Servis Maliyeti)</p>
                </div>
              ) : null}

              <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
                <Link href="/costs">
                  Skoru nasıl yükseltirim?
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className={`min-w-0 w-full ${inView ? "animate-slide-in-left" : "opacity-0"}`} style={{ animationDelay: "0.15s" }}>
            <div className="glass-card min-w-0 w-full rounded-3xl border border-border/60 bg-background/70 p-8 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.85)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold tracking-wide text-primary">Gerçekçi Örnek</span>
              </div>

              <h3 className="mt-4 text-xl font-semibold text-foreground">{exampleAsset.title}</h3>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                  <span className="text-muted-foreground">Varlık değeri</span>
                  <span className="font-semibold text-foreground">{tlFormatter.format(exampleAsset.valueTl)} TL</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                  <span className="text-muted-foreground">Son 12 ay bakım/servis</span>
                  <span className="font-semibold text-foreground">
                    {tlFormatter.format(exampleAsset.last12MonthServiceCostTl)} TL
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                  <span className="text-muted-foreground">Garanti</span>
                  <span className="font-semibold text-foreground">{exampleAsset.warrantyRemainingMonths} ay kaldı</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                  <span className="text-muted-foreground">Belgeler</span>
                  <span className="font-semibold text-foreground">
                    {exampleAsset.documentsCompleted}/{exampleAsset.documentsTotal} tamam
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/35 px-3 py-2">
                  <span className="text-muted-foreground">Son bakım</span>
                  <span className="font-semibold text-foreground">{exampleAsset.lastMaintenanceMonthsAgo} ay önce</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3">
                <span className="text-sm font-medium text-emerald-100">Skor</span>
                <span className="text-lg font-semibold text-emerald-100">
                  {exampleAsset.score}/100 ({exampleAsset.scoreLabel})
                </span>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-foreground">Neyi iyileştirir?</h4>
                <ul className="mt-2 space-y-2">
                  {exampleAsset.improvements.map((item) => (
                    <li
                      key={item.action}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{item.action}</span>
                      <span className="font-semibold text-primary">+{item.scoreGain}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_0.75fr]">
          <div className={`min-w-0 w-full ${inView ? "animate-slide-up" : "opacity-0"}`} style={{ animationDelay: "0.2s" }}>
            <div className="glass-card h-full min-w-0 w-full rounded-3xl border border-border/60 bg-background/70 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.85)]">
              <h3 className="text-sm font-semibold text-foreground">Skor Dağılımı</h3>
              <div className="mt-4 space-y-3">
                {scoreBreakdown.map((item) => (
                  <BreakdownBar key={item.key} label={item.label} score={item.score} toneClass={item.toneClass} />
                ))}
              </div>
            </div>
          </div>

          <div className={`min-w-0 w-full ${inView ? "animate-slide-up" : "opacity-0"}`} style={{ animationDelay: "0.28s" }}>
            <div className="glass-card h-full min-w-0 w-full overflow-hidden rounded-3xl border border-border/60 bg-background/70 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.85)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Trend</h3>
                <div className="inline-flex items-center gap-1 text-xs text-primary">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Son 6 ay
                </div>
              </div>
              <div className="mt-3 h-[180px] w-full min-w-0 max-w-full overflow-hidden">
                <Line className="!h-full !w-full" data={trendData} options={trendOptions} />
              </div>
            </div>
          </div>

          <div className={`min-w-0 w-full ${inView ? "animate-slide-up" : "opacity-0"}`} style={{ animationDelay: "0.36s" }}>
            <div className="glass-card h-full min-w-0 w-full rounded-3xl border border-border/60 bg-background/70 p-6 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.85)]">
              <h3 className="text-sm font-semibold text-foreground">Maliyet Verimliliği</h3>
              <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-4">
                <p className="text-xs text-primary">Değer / Maliyet Oranı</p>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                  {costEfficiencyRatio}x (İyi)
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {tlFormatter.format(exampleAsset.valueTl)} / {tlFormatter.format(exampleAsset.last12MonthServiceCostTl)} =
                  {" "}
                  {costEfficiencyRatio}x
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
