import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type FraudStatCardProps = {
  accent: string;
  description: string;
  icon: LucideIcon;
  title: string;
  value: string;
};

export function FraudStatCard({
  accent,
  description,
  icon: Icon,
  title,
  value,
}: FraudStatCardProps) {
  return (
    <Card className="gap-4 border-white/10 bg-[#0B1220]/95 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">{value}</p>
        </div>
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-slate-100"
          style={{ background: accent }}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="text-sm leading-6 text-slate-400">{description}</p>
    </Card>
  );
}
