import * as React from "react"

import { cn } from "@/lib/utils"

export type RiskBadgeLevel = "overdue" | "soon" | "ok"

export interface RiskBadgeProps extends React.ComponentProps<"span"> {
  level: RiskBadgeLevel
  label: string
}

const riskBadgeStyles: Record<RiskBadgeLevel, string> = {
  overdue: "border border-red-500/20 bg-red-500/10 text-red-400",
  soon: "border border-amber-500/20 bg-amber-500/10 text-amber-400",
  ok: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
}

function RiskBadge({ level, label, className, ...props }: RiskBadgeProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        riskBadgeStyles[level],
        className
      )}
      {...props}
    >
      {label}
    </span>
  )
}

export { RiskBadge }

