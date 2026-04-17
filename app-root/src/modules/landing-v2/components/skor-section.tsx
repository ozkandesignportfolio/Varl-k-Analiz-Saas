"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Award, BarChart3, CreditCard, FileText, Shield, Target, TrendingUp, Wrench } from "lucide-react";
import { createEmptyPanelHealthPayload, type PanelHealthPayload } from "@/lib/panel-health";
import { useInView } from "@/modules/landing-v2/hooks/use-in-view";

function AnimatedCircularScore({ score, inView }: { score: number; inView: boolean }) {
  const [currentScore, setCurrentScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCircle = useCallback((value: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const radius = 80;
    const lineWidth = 10;

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(26, 42, 74, 0.5)";
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (2 * Math.PI * value) / 100;
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#06d6a0");
    gradient.addColorStop(1, "#0ff0fc");

    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.strokeStyle = "rgba(6, 214, 160, 0.2)";
    ctx.lineWidth = lineWidth + 8;
    ctx.lineCap = "round";
    ctx.stroke();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();

    function animate(time: number) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.floor(eased * score);
      setCurrentScore(start);
      drawCircle(start);
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [drawCircle, inView, score]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas ref={canvasRef} className="h-[200px] w-[200px]" />
      <div className="absolute flex flex-col items-center">
        <div className="text-4xl font-bold text-foreground">{currentScore}</div>
        <div className="text-xs font-medium text-primary">/100</div>
      </div>
    </div>
  );
}

type ScoreSubItem = {
  label: string;
  score: number;
  color: string;
};

type ScoreCategory = {
  icon: LucideIcon;
  label: string;
  score: number;
  color: string;
  subItems?: ScoreSubItem[];
};

const toScore = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const toCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};

const toAmount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizePanelHealth = (value: unknown): PanelHealthPayload => {
  const fallback = createEmptyPanelHealthPayload("public_fallback");
  if (!isRecord(value)) return fallback;

  const warranty = isRecord(value.warranty) ? value.warranty : {};
  const maintenance = isRecord(value.maintenance) ? value.maintenance : {};
  const documents = isRecord(value.documents) ? value.documents : {};
  const payments = isRecord(value.payments) ? value.payments : {};
  const scope = value.scope === "user" ? "user" : "public_fallback";

  return {
    score: toScore(value.score),
    ratio: Math.max(0, Number(value.ratio ?? 0) || 0),
    hasNoCost: Boolean(value.hasNoCost),
    assetPrice: toAmount(value.assetPrice),
    totalCost: toAmount(value.totalCost),
    maintenanceCost: toAmount(value.maintenanceCost),
    expenseCost: toAmount(value.expenseCost),
    warranty: {
      score: toScore(warranty.score),
      active: toScore(warranty.active),
      expiring: toScore(warranty.expiring),
      expired: toScore(warranty.expired),
      unknown: toScore(warranty.unknown),
    },
    maintenance: {
      score: toScore(maintenance.score),
      planned: toCount(maintenance.planned),
      completed: toCount(maintenance.completed),
      onTrack: toCount(maintenance.onTrack),
      overdue: toCount(maintenance.overdue),
    },
    documents: {
      score: toScore(documents.score),
      required: toCount(documents.required),
      uploaded: toCount(documents.uploaded),
      missing: toCount(documents.missing),
    },
    payments: {
      score: toScore(payments.score),
      paid: toCount(payments.paid),
      pending: toCount(payments.pending),
      overdue: toCount(payments.overdue),
      total: toCount(payments.total),
    },
    scope,
    warning: typeof value.warning === "string" ? value.warning : null,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
  };
};

function ScoreBarRow({
  label,
  score,
  color,
  compact = false,
}: {
  label: string;
  score: number;
  color: string;
  compact?: boolean;
}) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const width = safeScore > 0 ? Math.max(4, safeScore) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <div className={compact ? "text-[11px] text-muted-foreground" : "text-xs text-muted-foreground"}>{label}</div>
        <div className={`relative z-10 mt-1 w-full overflow-hidden rounded-full bg-secondary/60 ring-1 ring-white/10 ${compact ? "h-1.5" : "h-2"}`}>
          <div className={`absolute inset-y-0 left-0 z-20 rounded-full ${color}`} style={{ width: `${width}%` }} />
        </div>
      </div>
      <span className={compact ? "text-[11px] font-semibold text-foreground" : "text-xs font-semibold text-foreground"}>{safeScore}/100</span>
    </div>
  );
}

export function SkorSection() {
  const { ref, inView } = useInView();
  const [health, setHealth] = useState<PanelHealthPayload>(() => createEmptyPanelHealthPayload("public_fallback"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/panel-health", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("panel health request failed");
        }

        const body = (await response.json().catch(() => null)) as unknown;
        if (controller.signal.aborted) return;
        setHealth(normalizePanelHealth(body));
      } catch {
        if (!controller.signal.aborted) {
          setHealth(createEmptyPanelHealthPayload("public_fallback"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  const ratioLabel = health.hasNoCost
    ? "Toplam maliyet 0 olduğu için skor 100 kabul edildi."
    : `Oran: ${health.ratio.toFixed(2)} (varlık fiyatı / toplam maliyet)`;

  const scoreCategories: ScoreCategory[] = useMemo(() => {
    const hasPlannedMaintenance = health.maintenance.planned > 0;
    const hasRequiredDocuments = health.documents.required > 0;
    const hasPayments = health.payments.total > 0;

    const maintenanceCompletedRate = hasPlannedMaintenance
      ? (health.maintenance.completed / health.maintenance.planned) * 100
      : 100;
    const maintenanceOverdueRate = hasPlannedMaintenance
      ? (health.maintenance.overdue / health.maintenance.planned) * 100
      : 0;
    const maintenanceOnTrackRate = hasPlannedMaintenance
      ? (health.maintenance.onTrack / health.maintenance.planned) * 100
      : 100;

    const uploadedDocumentsRate = hasRequiredDocuments
      ? (health.documents.uploaded / health.documents.required) * 100
      : 100;
    const missingDocumentsRate = hasRequiredDocuments
      ? (health.documents.missing / health.documents.required) * 100
      : 0;

    const paidRate = hasPayments ? (health.payments.paid / health.payments.total) * 100 : 100;
    const pendingRate = hasPayments ? (health.payments.pending / health.payments.total) * 100 : 0;
    const overdueRate = hasPayments ? (health.payments.overdue / health.payments.total) * 100 : 0;

    const warrantySubItems: ScoreSubItem[] = [
      { label: "Aktif garanti", score: health.warranty.active, color: "bg-emerald-400" },
      { label: "Yakında bitecek", score: health.warranty.expiring, color: "bg-amber-400" },
      { label: "Süresi dolan", score: health.warranty.expired, color: "bg-rose-400" },
    ];

    if (health.warranty.unknown > 0) {
      warrantySubItems.push({ label: "Tarihi girilmemiş", score: health.warranty.unknown, color: "bg-slate-400" });
    }

    return [
      {
        icon: Shield,
        label: "Garanti Durumu",
        score: health.warranty.score,
        color: "bg-primary",
        subItems: warrantySubItems,
      },
      {
        icon: Wrench,
        label: "Bakım Uyumu",
        score: health.maintenance.score,
        color: "bg-accent",
        subItems: [
          { label: "Gerçekleşen bakım", score: maintenanceCompletedRate, color: "bg-emerald-400" },
          { label: "Plan takvimi uyumu", score: maintenanceOnTrackRate, color: "bg-cyan-400" },
          { label: "Geciken bakım", score: maintenanceOverdueRate, color: "bg-rose-400" },
        ],
      },
      {
        icon: FileText,
        label: "Belge Tamlığı",
        score: health.documents.score,
        color: "bg-chart-3",
        subItems: [
          { label: "Yüklenen belge", score: uploadedDocumentsRate, color: "bg-emerald-400" },
          { label: "Eksik belge", score: missingDocumentsRate, color: "bg-rose-400" },
        ],
      },
      {
        icon: CreditCard,
        label: "Ödeme Durumu",
        score: health.payments.score,
        color: "bg-chart-4",
        subItems: [
          { label: "Ödenen", score: paidRate, color: "bg-emerald-400" },
          { label: "Bekleyen", score: pendingRate, color: "bg-amber-400" },
          { label: "Geciken", score: overdueRate, color: "bg-rose-400" },
        ],
      },
    ];
  }, [health]);

  return (
    <section id="skor-analizi" className="relative isolate py-32" ref={ref}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[150px] sm:block" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div className={`order-2 lg:order-1 ${inView ? "animate-slide-up" : "opacity-0"}`}>
            <div className="glass-card rounded-3xl p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">Varlık Sağlık Skoru</div>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-xs text-primary">{isLoading ? "Veri yükleniyor..." : ratioLabel}</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="mb-8 flex justify-center">
                <AnimatedCircularScore score={health.score} inView={inView} />
              </div>

              <div className="flex flex-col gap-3">
                {scoreCategories.map((cat) => (
                  <div key={cat.label} className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60">
                        <cat.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <ScoreBarRow label={cat.label} score={cat.score} color={cat.color} />
                      </div>
                    </div>

                    {cat.subItems ? (
                      <div className="mt-2 space-y-2 pl-11">
                        {cat.subItems.map((subItem) => (
                          <ScoreBarRow key={subItem.label} label={subItem.label} score={subItem.score} color={subItem.color} compact />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`order-1 lg:order-2 ${inView ? "animate-slide-in-left" : "opacity-0"}`}
            style={{ animationDelay: "0.2s" }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-chart-3/20 bg-chart-3/5 px-4 py-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-chart-3" />
              <span className="text-xs tracking-widest text-chart-3">Skor Analizi</span>
            </div>
            <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
              Varlık sağlığınızı <span className="text-gradient">ölçümleyin</span>
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Her varlığınızın garanti, bakım, belge ve ödeme durumunu birleşik skorla ölçün. Zayıf noktaları hızla
              tespit edin ve aksiyon alın.
            </p>

            <div className="mt-8 rounded-2xl border border-chart-3/20 bg-chart-3/5 p-4">
              <h3 className="text-sm font-semibold text-foreground">Skor Analizi nasıl hesaplanır?</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Skor, oran bazlı ve normalize bir modelle hesaplanır:
                <span className="font-semibold text-foreground"> ratio = varlık fiyatı / toplam maliyet</span>
                (toplam maliyet = bakım + harcama). Toplam maliyet 0 ise skor doğrudan 100 kabul edilir.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Eşikler:
                <span className="font-semibold text-foreground"> ratio &lt; 1 = 20</span>,
                <span className="font-semibold text-foreground"> 1-2 = 40</span>,
                <span className="font-semibold text-foreground"> 2-4 = 60</span>,
                <span className="font-semibold text-foreground"> 4-8 = 80</span>,
                <span className="font-semibold text-foreground"> 8 üzeri = 95</span>.
              </p>
            </div>

            {health.warning ? (
              <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                {health.warning}
              </div>
            ) : null}

            <div className="mt-10 flex flex-col gap-4">
              {[
                { icon: BarChart3, label: "Birleşik Skor", desc: "Oran bazlı normalize edilmiş genel sağlık puanı" },
                { icon: TrendingUp, label: "Trend Takibi", desc: "Aylık skor değişimlerini grafikle izleyin" },
                { icon: Target, label: "Aksiyon Önerileri", desc: "Skoru artırmak için otomatik tavsiyeler" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-4 rounded-xl border border-border/50 bg-secondary/30 p-4 transition-all hover:border-chart-3/20 hover:bg-secondary/50"
                >
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
  );
}
