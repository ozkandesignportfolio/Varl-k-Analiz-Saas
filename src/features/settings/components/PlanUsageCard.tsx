"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserPlan } from "@/contexts/PlanContext";

type UsageItem = {
  id: string;
  label: string;
  used: number;
  limit: number | null;
  note?: string;
};

type PlanUsageCardProps = {
  plan: UserPlan;
  items: UsageItem[];
};

const getPercent = (used: number, limit: number | null) => {
  if (limit === null || limit <= 0) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
};

const formatRatio = (used: number, limit: number | null) => `${used}/${limit ?? "∞"}`;

export function PlanUsageCard({ plan, items }: PlanUsageCardProps) {
  const isPremium = plan === "premium";

  return (
    <section className="premium-card border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Plan & Kullanım</h3>
          <p className="mt-1 text-sm text-slate-300">
            Kullanım durumunu takip edin ve ihtiyaç halinde planınızı yükseltin.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            isPremium
              ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
              : "border-amber-300/35 bg-amber-300/10 text-amber-100"
          }
        >
          {isPremium ? "Premium" : "Deneme"}
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const percent = getPercent(item.used, item.limit);
          return (
            <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-slate-300">{formatRatio(item.used, item.limit)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-300/80 to-cyan-200/80"
                  style={{ width: `${percent}%` }}
                />
              </div>
              {item.note ? <p className="mt-2 text-xs text-slate-400">{item.note}</p> : null}
            </article>
          );
        })}
      </div>

      <Button asChild className="mt-5 bg-white/10 text-white hover:bg-white/15">
        <Link href="/pricing">Premium&apos;a Geç</Link>
      </Button>
    </section>
  );
}

