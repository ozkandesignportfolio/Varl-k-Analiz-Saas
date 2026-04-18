import Link from "next/link";
import { memo } from "react";
import {
  ArrowRight,
  FileText,
  Package,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { DashboardDateRangeDays, DashboardSnapshot } from "@/features/dashboard/api/dashboard-queries";

const NUMBER_FORMATTER = new Intl.NumberFormat("tr-TR");
const CURRENCY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type KPICardsProps = {
  metrics: DashboardSnapshot["metrics"];
  trends: DashboardSnapshot["trends"];
  selectedRange: DashboardDateRangeDays;
};

type KpiCardId = "assets" | "rules" | "costs" | "documents";

type KpiInsightTone = "positive" | "negative" | "neutral";

type KpiInsight = {
  tone: KpiInsightTone;
  label: string;
};

type KpiCardItem = {
  id: KpiCardId;
  title: string;
  value: string;
  context: string;
  isEmpty: boolean;
  insight: KpiInsight | null;
  emptyHint: string;
  ctaLabel: string;
  icon: LucideIcon;
  href: string;
};

const formatCurrency = (value: number) => `${CURRENCY_FORMATTER.format(value)} TL`;

const INSIGHT_TONE_STYLES: Record<KpiInsightTone, { text: string; dot: string }> = {
  positive: { text: "text-emerald-300/80", dot: "bg-emerald-400/70" },
  negative: { text: "text-amber-300/80", dot: "bg-amber-400/70" },
  neutral: { text: "text-[#8DA6C8]/60", dot: "bg-slate-400/50" },
};

// Count-like metrics (varlık/kural/belge): up = pozitif, down = dikkat, düz = aktivite yok
const buildCountInsight = (
  trend: DashboardSnapshot["trends"]["totalAssets"],
): KpiInsight | null => {
  const points = trend.sparkline;
  if (points.length < 2 && trend.direction === "flat") {
    return { tone: "neutral", label: "Aktivite yok" };
  }
  if (trend.direction === "up") return { tone: "positive", label: "İyi seviyede" };
  if (trend.direction === "down") return { tone: "negative", label: "Dikkat" };
  return { tone: "neutral", label: "Aktivite yok" };
};

// Maliyet metriği: down = iyi, up = dikkat, düz = sabit
const buildCostInsight = (
  trend: DashboardSnapshot["trends"]["totalServiceCost"],
): KpiInsight | null => {
  if (trend.direction === "down") return { tone: "positive", label: "İyi seviyede" };
  if (trend.direction === "up") return { tone: "negative", label: "Dikkat" };
  return { tone: "neutral", label: "Değişim yok" };
};

export function KPICards({ metrics, trends, selectedRange }: KPICardsProps) {
  const rangeLabel = `Son ${selectedRange} gün`;
  const cards: KpiCardItem[] = [
    {
      id: "assets",
      title: "Toplam Varlık",
      value: NUMBER_FORMATTER.format(metrics.totalAssets),
      context: "Kayıtlı varlık sayısı",
      isEmpty: metrics.totalAssets === 0,
      insight: buildCountInsight(trends.totalAssets),
      emptyHint: "Henüz varlık eklenmedi",
      ctaLabel: "Varlık ekle",
      icon: Package,
      href: "/assets",
    },
    {
      id: "rules",
      title: "Aktif Bakım Kuralı",
      value: NUMBER_FORMATTER.format(metrics.activeRules),
      context: "Tanımlı aktif kural",
      isEmpty: metrics.activeRules === 0,
      insight: buildCountInsight(trends.activeRules),
      emptyHint: "Henüz bakım kuralı yok",
      ctaLabel: "Kural oluştur",
      icon: Wrench,
      href: "/maintenance",
    },
    {
      id: "costs",
      title: "Toplam Servis Maliyeti",
      value: formatCurrency(metrics.totalServiceCost),
      context: rangeLabel,
      isEmpty: metrics.totalServiceCost === 0,
      insight: buildCostInsight(trends.totalServiceCost),
      emptyHint: "Bu dönem servis kaydı yok",
      ctaLabel: "Servis ekle",
      icon: TrendingUp,
      href: "/costs",
    },
    {
      id: "documents",
      title: "Belge Sayısı",
      value: NUMBER_FORMATTER.format(metrics.documentCount),
      context: "Yüklü belge sayısı",
      isEmpty: metrics.documentCount === 0,
      insight: buildCountInsight(trends.documentCount),
      emptyHint: "Henüz belge yüklenmedi",
      ctaLabel: "Belge yükle",
      icon: FileText,
      href: "/documents",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight text-[#F8FAFC]">Özet Metrikler</h2>
        <p className="text-xs text-[#8DA6C8]">{rangeLabel}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <KpiCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

const KpiCard = memo(function KpiCard({ card }: { card: KpiCardItem }) {
  const Icon = card.icon;

  return (
    <Link
      href={card.href}
      className="group relative flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]/40"
      data-testid={`dashboard-kpi-${card.id}-card`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#8DA6C8]">{card.title}</p>
        <Icon className="size-4 text-[#8DA6C8]/70" aria-hidden />
      </div>

      <p
        className="mt-6 text-3xl font-semibold tracking-tight text-[#F8FAFC]"
        data-testid={`dashboard-kpi-${card.id}-value`}
      >
        {card.value}
      </p>
      <p className="mt-1.5 text-xs text-[#8DA6C8]/70">
        {card.isEmpty ? card.emptyHint : card.context}
      </p>
      {!card.isEmpty && card.insight ? (
        <p
          className={`mt-1 inline-flex items-center gap-1.5 text-xs ${INSIGHT_TONE_STYLES[card.insight.tone].text}`}
          data-testid={`dashboard-kpi-${card.id}-insight`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${INSIGHT_TONE_STYLES[card.insight.tone].dot}`}
          />
          {card.insight.label}
        </p>
      ) : null}

      <span className="mt-4 inline-flex items-center gap-1 text-xs text-[#8DA6C8] opacity-70 transition-opacity duration-200 group-hover:text-[#E2ECFF] group-hover:opacity-100 group-focus-visible:opacity-100">
        {card.isEmpty ? card.ctaLabel : "Detaya git"}
        <ArrowRight
          className="size-3.5 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
          aria-hidden
        />
      </span>
    </Link>
  );
});
