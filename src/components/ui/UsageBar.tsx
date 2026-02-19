import * as React from "react"

import { cn } from "@/lib/utils"

type UsageBarVariant = "default" | "danger" | "warning" | "success"

export interface UsageBarProps {
  used: number
  total: number
  label: string
  variant: UsageBarVariant
  className?: string
}

const variantFill: Record<UsageBarVariant, string> = {
  default: "from-[#6366F1] to-[#8B5CF6]",
  danger: "from-red-500 to-red-600",
  warning: "from-amber-500 to-orange-500",
  success: "from-emerald-500 to-teal-500",
}

function UsageBar({
  used,
  total,
  label,
  variant,
  className,
}: UsageBarProps) {
  const safeTotal = total > 0 ? total : 0
  const rawPercent = safeTotal > 0 ? (used / safeTotal) * 100 : 0
  const percentage = Math.max(0, Math.min(rawPercent, 100))
  const isAtLimit = percentage >= 100
  const isNearLimit = percentage > 80 && percentage < 100

  const fillClass = isAtLimit
    ? "from-red-500 to-rose-600 animate-pulse"
    : isNearLimit
      ? "from-amber-500 to-orange-500"
      : variantFill[variant]

  return (
    <div
      role="region"
      aria-label={`${label} kullanım durumu`}
      className={cn(
        "rounded-2xl border border-[#1E293B] bg-[#0E1525] p-4",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-tight text-[#94A3B8]">{label}</p>
        <p className="text-xs text-[#CBD5E1]">
          {used} / {total} kullanıldı
        </p>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#080D1A]">
        <div
          role="progressbar"
          aria-label={`${label} kullanım oranı`}
          aria-valuemin={0}
          aria-valuemax={safeTotal || 100}
          aria-valuenow={Math.min(used, safeTotal || used)}
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-300",
            fillClass
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export { UsageBar }
