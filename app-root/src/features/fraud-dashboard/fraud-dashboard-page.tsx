"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, AlertTriangle, ShieldAlert, UserRoundX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FraudAttemptsTable } from "@/features/fraud-dashboard/components/fraud-attempts-table";
import { FraudFilters } from "@/features/fraud-dashboard/components/fraud-filters";
import { FraudRankedList } from "@/features/fraud-dashboard/components/fraud-ranked-list";
import { FraudStatCard } from "@/features/fraud-dashboard/components/fraud-stat-card";
import { useFraudStats } from "@/features/fraud-dashboard/hooks/useFraudStats";
import type { FraudStatsFilters } from "@/lib/fraud/types";

// Chart.js + controllers are only needed once fraud stats have loaded.
// Defer the module so the initial admin dashboard bundle stays small.
const FraudCharts = dynamic(
  () => import("@/features/fraud-dashboard/components/fraud-charts").then((m) => m.FraudCharts),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-2xl bg-white/5" /> },
);

const DEFAULT_FILTERS: FraudStatsFilters = {
  email: "",
  eventType: "all",
  ip: "",
  limit: 120,
  riskMax: 100,
  riskMin: 0,
  windowHours: 24 * 7,
};

export function FraudDashboardPage() {
  const [filters, setFilters] = useState<FraudStatsFilters>(DEFAULT_FILTERS);
  const { data, error, isLoading, isRefreshing, refresh } = useFraudStats(filters);

  const subtitle = useMemo(() => {
    if (!data) {
      return "Real-time monitoring for signup abuse, rate limits, bot failures, and high-risk identity patterns.";
    }

    return `Last refresh ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(data.generatedAt),
    )}`;
  }, [data]);

  return (
    <AppShell
      badge="Admin Control"
      subtitle={subtitle}
      title="Fraud Intelligence"
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/15"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FraudStatCard
            accent="linear-gradient(135deg, rgba(56,189,248,0.28), rgba(14,165,233,0.08))"
            description="Total signup-related decisions in the active filter window."
            icon={Activity}
            title="Total Signups"
            value={isLoading || !data ? "--" : String(data.summary.totalSignups)}
          />
          <FraudStatCard
            accent="linear-gradient(135deg, rgba(249,115,22,0.28), rgba(251,146,60,0.08))"
            description="Attempts blocked by validation, bot checks, or abuse controls."
            icon={ShieldAlert}
            title="Blocked Attempts"
            value={isLoading || !data ? "--" : String(data.summary.blockedAttempts)}
          />
          <FraudStatCard
            accent="linear-gradient(135deg, rgba(168,85,247,0.28), rgba(192,132,252,0.08))"
            description="Mean risk score blended from Redis intelligence and persisted metadata."
            icon={AlertTriangle}
            title="Avg Risk Score"
            value={isLoading || !data ? "--" : String(data.summary.averageRiskScore)}
          />
          <FraudStatCard
            accent="linear-gradient(135deg, rgba(244,63,94,0.28), rgba(251,113,133,0.08))"
            description="Unique high-risk identities with a score of 60 or above."
            icon={UserRoundX}
            title="High-Risk Users"
            value={isLoading || !data ? "--" : String(data.summary.highRiskUsersCount)}
          />
        </div>

        <FraudFilters filters={filters} onChange={setFilters} />

        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {data ? <FraudCharts charts={data.charts} /> : null}

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <FraudAttemptsTable attempts={data?.attempts ?? []} />
          <div className="space-y-4">
            <FraudRankedList
              title="Top Risky IPs"
              description="IPs with the highest maximum risk score inside the filtered window."
              items={data?.topRiskyIps ?? []}
            />
            <FraudRankedList
              title="Top Risky Emails"
              description="Email identities repeatedly linked to elevated signup risk."
              items={data?.topRiskyEmails ?? []}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
