import * as React from "react"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type MetricCardVariant = "default" | "danger" | "warning" | "success"
type MetricCardTrend = "up" | "down"

export interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: MetricCardTrend
  trendValue?: string | number
  icon: React.ReactNode
  variant: MetricCardVariant
  className?: string
}

const variantStyles: Record<
  MetricCardVariant,
  {
    strip: string
    iconWrap: string
    iconColor: string
  }
> = {
  default: {
    strip: "from-indigo-400/0 via-indigo-400 to-indigo-400/0",
    iconWrap: "bg-indigo-500/10",
    iconColor: "text-indigo-400",
  },
  danger: {
    strip: "from-red-400/0 via-red-400 to-red-400/0",
    iconWrap: "bg-red-500/10",
    iconColor: "text-red-400",
  },
  warning: {
    strip: "from-amber-400/0 via-amber-400 to-amber-400/0",
    iconWrap: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
  success: {
    strip: "from-emerald-400/0 via-emerald-400 to-emerald-400/0",
    iconWrap: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
}

function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon,
  variant,
  className,
}: MetricCardProps) {
  const styles = variantStyles[variant]
  const showTrend = trend && trendValue !== undefined && trendValue !== null

  return (
    <div
      role="region"
      aria-label={`${label} metrik kartı`}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#1E293B] bg-[#0E1525] p-5",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn("absolute inset-x-4 top-0 h-px bg-gradient-to-r", styles.strip)}
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          aria-hidden="true"
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5",
            styles.iconWrap,
            styles.iconColor
          )}
        >
          {icon}
        </div>

        {showTrend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold",
              trend === "up" ? "text-emerald-400" : "text-red-400"
            )}
            aria-label={`Trend ${trend === "up" ? "yukarı" : "aşağı"} ${trendValue}`}
          >
            {trend === "up" ? (
              <TrendingUpIcon className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <TrendingDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {trendValue}
          </span>
        ) : null}
      </div>

      <div className="mb-2 flex items-end gap-1.5">
        <span className="font-mono text-3xl font-semibold text-[#F1F5F9]">{value}</span>
        {unit ? <span className="pb-1 text-sm text-[#94A3B8]">{unit}</span> : null}
      </div>

      <p className="text-xs uppercase tracking-tight text-[#94A3B8]">{label}</p>
    </div>
  )
}

export { MetricCard }
