import type { LucideIcon } from "lucide-react";

type TrendTone = "neutral" | "positive" | "negative";

type MetricCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trendLabel?: string;
  trendTone?: TrendTone;
};

const TREND_STYLES: Record<TrendTone, string> = {
  neutral: "text-[#94A3B8]",
  positive: "text-emerald-400",
  negative: "text-rose-400",
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  trendLabel = "Stabil",
  trendTone = "neutral",
}: MetricCardProps) {
  return (
    <article className="rounded-xl border border-[#1E293B] bg-[#0E1525]/85 p-4 shadow-[0_12px_28px_rgba(2,6,23,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#64748B]">{title}</p>
        <span className="rounded-lg border border-[#1E293B] bg-[#0B1120] p-2 text-[#94A3B8]">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC]">{value}</p>
      <p className={`mt-2 text-xs font-medium ${TREND_STYLES[trendTone]}`}>{trendLabel}</p>
    </article>
  );
}
