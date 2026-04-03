"use client";

import { Card } from "@/components/ui/card";
import type { FraudRankedEntity } from "@/lib/fraud/types";

type FraudRankedListProps = {
  description: string;
  items: FraudRankedEntity[];
  title: string;
};

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export function FraudRankedList({ description, items, title }: FraudRankedListProps) {
  return (
    <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
            No risky identities in the current window.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.value} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-mono text-sm text-slate-100">{item.value}</p>
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-100">
                  {item.maxRiskScore}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>{item.count} attempts</span>
                <span>Avg {item.averageRiskScore}</span>
                <span>Seen {formatTimestamp(item.lastSeenAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
