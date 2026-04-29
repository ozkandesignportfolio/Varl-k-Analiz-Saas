"use client";

import { memo, useMemo } from "react";
import { ControlCenterHeader } from "@/features/dashboard/components/ControlCenterHeader";
import { KPICards } from "@/features/dashboard/components/KPICards";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { RecentActivity } from "@/features/dashboard/components/RecentActivity";
import { RisksAndUpcoming } from "@/features/dashboard/components/RisksAndUpcoming";
import { UsageLimitsCard, type UsageLimitItem } from "@/features/dashboard/components/UsageLimitsCard";
import { useDashboardRange } from "@/features/dashboard/context/DashboardRangeContext";

type DashboardContentProps = {
  userId: string;
  planLabel: string;
  planCode: string;
  planLimits: {
    assetsLimit: number | null;
    documentsLimit: number | null;
    subscriptionsLimit: number | null;
    invoiceUploadsLimit: number | null;
  };
  showEmailVerificationSuccess: boolean;
};

export const DashboardContent = memo(function DashboardContent({
  userId,
  planLabel,
  planCode,
  planLimits,
  showEmailVerificationSuccess,
}: DashboardContentProps) {
  const { selectedRange, snapshot, isSwitching } = useDashboardRange();

  const usageItems = useMemo<UsageLimitItem[]>(
    () => [
      {
        id: "assets",
        label: "Varlıklar",
        used: snapshot.data.metrics.totalAssets,
        limit: planLimits.assetsLimit,
      },
      {
        id: "documents",
        label: "Belgeler",
        used: snapshot.data.metrics.documentCount,
        limit: planLimits.documentsLimit,
      },
      {
        id: "subscriptions",
        label: "Abonelikler",
        used: snapshot.data.metrics.subscriptionCount,
        limit: planLimits.subscriptionsLimit,
      },
      {
        id: "invoices",
        label: "Fatura",
        used: snapshot.data.metrics.invoiceCount,
        limit: planLimits.invoiceUploadsLimit,
      },
    ],
    [snapshot.data.metrics, planLimits],
  );

  return (
    <div className="space-y-6 rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.13),transparent_56%)] p-2 sm:p-3">
      {showEmailVerificationSuccess ? (
        <p className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          E-posta adresiniz doğrulandı.
        </p>
      ) : null}

      {snapshot.warning ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {snapshot.warning}
        </p>
      ) : null}

      <ControlCenterHeader userId={userId} selectedRange={selectedRange} status={snapshot.data.status} riskPanel={snapshot.data.riskPanel} />

      <div className={isSwitching ? "pointer-events-none opacity-70 transition-opacity duration-150" : "transition-opacity duration-150"}>
        <KPICards metrics={snapshot.data.metrics} trends={snapshot.data.trends} selectedRange={selectedRange} />
      </div>

      <QuickActions />

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <RisksAndUpcoming userId={userId} riskPanel={snapshot.data.riskPanel} />
        <UsageLimitsCard
          planLabel={planLabel}
          isPremium={planCode !== "starter"}
          items={usageItems}
        />
      </section>

      <RecentActivity activities={snapshot.data.recentActivity} />
    </div>
  );
});
