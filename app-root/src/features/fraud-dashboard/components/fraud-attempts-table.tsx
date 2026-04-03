"use client";

import { Card } from "@/components/ui/card";
import type { FraudAttempt } from "@/lib/fraud/types";

type FraudAttemptsTableProps = {
  attempts: FraudAttempt[];
};

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getRiskStyles = (riskLevel: FraudAttempt["riskLevel"]) => {
  if (riskLevel === "critical" || riskLevel === "high") {
    return "border border-rose-500/20 bg-rose-500/10 text-rose-200";
  }

  if (riskLevel === "medium") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-100";
  }

  return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
};

export function FraudAttemptsTable({ attempts }: FraudAttemptsTableProps) {
  return (
    <Card className="gap-4 border-white/10 bg-[#09111F]/90 p-0">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-50">Recent Signup Attempts</h2>
        <p className="mt-1 text-sm text-slate-400">Live feed of recent signup security decisions with normalized event classification.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">IP</th>
              <th className="px-5 py-3 font-medium">Risk</th>
              <th className="px-5 py-3 font-medium">Event</th>
              <th className="px-5 py-3 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                  No signup attempts matched the current filters.
                </td>
              </tr>
            ) : (
              attempts.map((attempt) => (
                <tr key={attempt.id} className="border-b border-white/5 text-sm text-slate-200 transition hover:bg-white/[0.02]">
                  <td className="px-5 py-3 align-top">
                    <div className="font-medium text-slate-100">{attempt.email || "Unknown email"}</div>
                    <div className="mt-1 text-xs text-slate-500">{attempt.rawEventType}</div>
                  </td>
                  <td className="px-5 py-3 align-top font-mono text-xs text-slate-300">{attempt.ip || "Unknown IP"}</td>
                  <td className="px-5 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getRiskStyles(attempt.riskLevel)}`}>
                        {attempt.riskLevel}
                      </span>
                      <span className="text-sm font-semibold text-slate-100">{attempt.riskScore}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      M:{attempt.riskSources.metadata} I:{attempt.riskSources.ip} E:{attempt.riskSources.email}
                    </p>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-200">
                      {attempt.eventType}
                    </span>
                  </td>
                  <td className="px-5 py-3 align-top text-xs text-slate-400">{formatTimestamp(attempt.occurredAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
