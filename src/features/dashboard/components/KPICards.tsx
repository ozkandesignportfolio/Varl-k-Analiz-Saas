import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Package,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { DashboardDateRangeDays, DashboardSnapshot, DashboardTrendDirection } from "@/features/dashboard/api/dashboard-queries";

const SPARKLINE_LENGTH = 6;

type KPICardsProps = {
  metrics: DashboardSnapshot["metrics"];
  trends: DashboardSnapshot["trends"];
  selectedRange: DashboardDateRangeDays;
};

type KpiCardItem = {
  id: "assets" | "rules" | "costs" | "documents";
  title: string;
  value: string;
  trend: DashboardSnapshot["trends"]["totalAssets"];
  icon: LucideIcon;
  href: string;
};

const TREND_META: Record<
  DashboardTrendDirection,
  {
    icon: LucideIcon;
    textClass: string;
    sparklineClass: string;
    symbol: string;
  }
> = {
  up: {
    icon: ArrowUpRight,
    textClass: "text-emerald-200",
    sparklineClass: "stroke-emerald-300",
    symbol: "+",
  },
  down: {
    icon: ArrowDownRight,
    textClass: "text-rose-200",
    sparklineClass: "stroke-rose-300",
    symbol: "-",
  },
  flat: {
    icon: ArrowRight,
    textClass: "text-slate-200",
    sparklineClass: "stroke-slate-300",
    symbol: "0",
  },
};

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} TL`;

export function KPICards({ metrics, trends, selectedRange }: KPICardsProps) {
  const cards: KpiCardItem[] = [
    {
      id: "assets",
      title: "Toplam Varlık",
      value: new Intl.NumberFormat("tr-TR").format(metrics.totalAssets),
      trend: trends.totalAssets,
      icon: Package,
      href: "/assets",
    },
    {
      id: "rules",
      title: "Aktif Bakım Kuralı",
      value: new Intl.NumberFormat("tr-TR").format(metrics.activeRules),
      trend: trends.activeRules,
      icon: Wrench,
      href: "/maintenance",
    },
    {
      id: "costs",
      title: "Toplam Servis Maliyeti",
      value: formatCurrency(metrics.totalServiceCost),
      trend: trends.totalServiceCost,
      icon: TrendingUp,
      href: "/costs",
    },
    {
      id: "documents",
      title: "Belge Sayisi",
      value: new Intl.NumberFormat("tr-TR").format(metrics.documentCount),
      trend: trends.documentCount,
      icon: FileText,
      href: "/documents",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Özet Metrikler</h2>
        <p className="text-xs uppercase tracking-[0.14em] text-[#8DA6C8]">Son {selectedRange} gün trendi</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {cards.map((card) => (
          <KpiCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function KpiCard({ card }: { card: KpiCardItem }) {
  const trendMeta = TREND_META[card.trend.direction];
  const TrendIcon = trendMeta.icon;
  const Icon = card.icon;

  return (
    <article className="rounded-2xl border border-[#273955] bg-[linear-gradient(160deg,rgba(10,22,44,0.92),rgba(11,19,33,0.84))] p-4 shadow-[0_16px_34px_rgba(2,8,20,0.36)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[#89A2C5]">{card.title}</p>
        <span className="inline-flex rounded-lg border border-[#2E4467] bg-[#10223E] p-2 text-[#9AB2D1]">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC]">{card.value}</p>

      <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${trendMeta.textClass}`}>
        <TrendIcon className="size-3.5" aria-hidden />
        <span>
          {trendMeta.symbol}
          {card.trend.percentage}%
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-[#2A3D5B] bg-[#0A162A]/70 p-2">
        <Sparkline points={card.trend.sparkline} pathClass={trendMeta.sparklineClass} />
      </div>

      <Link
        href={card.href}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#B8CEF0] transition hover:text-[#E2ECFF]"
      >
        Detaya git
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  );
}

function Sparkline({ points, pathClass }: { points: number[]; pathClass: string }) {
  const safePoints = points.length > 0 ? points : Array.from({ length: 6 }, () => 10);
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints, 0);
  const range = Math.max(1, max - min);
  const xStep = 100 / Math.max(1, SPARKLINE_LENGTH - 1);

  const polylinePoints = safePoints
    .slice(0, SPARKLINE_LENGTH)
    .map((point, index) => {
      const x = index * xStep;
      const normalized = (point - min) / range;
      const y = 90 - normalized * 70;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-10 w-full" preserveAspectRatio="none">
      <polyline
        points={polylinePoints}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={pathClass}
      />
    </svg>
  );
}
