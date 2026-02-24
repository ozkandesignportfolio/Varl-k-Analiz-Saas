import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getDashboardSnapshot, parseDashboardDateRange } from "@/features/dashboard/api/dashboard-queries";
import { ControlCenterHeader } from "@/features/dashboard/components/ControlCenterHeader";
import { KPICards } from "@/features/dashboard/components/KPICards";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { RecentActivity } from "@/features/dashboard/components/RecentActivity";
import { RisksAndUpcoming } from "@/features/dashboard/components/RisksAndUpcoming";
import { UsageLimitsCard, type UsageLimitItem } from "@/features/dashboard/components/UsageLimitsCard";
import { getOrCreateProfilePlan, getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import type { DbClient } from "@/lib/repos/_shared";
import { createClient } from "@/lib/supabase/server";

type SearchParamValue = string | string[] | undefined;
export type DashboardPageSearchParams =
  | Promise<Record<string, SearchParamValue>>
  | Record<string, SearchParamValue>;

type DashboardPageContainerProps = {
  searchParams?: DashboardPageSearchParams;
};

const formatPanelDate = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

const parseRangeParam = async (searchParams?: DashboardPageSearchParams) => {
  const resolved = (await Promise.resolve(searchParams ?? {})) as Record<string, SearchParamValue>;
  const rawRange = resolved.range;
  const normalized = Array.isArray(rawRange) ? rawRange[0] : rawRange;
  return parseDashboardDateRange(normalized);
};

export async function DashboardPageContainer({ searchParams }: DashboardPageContainerProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const selectedRange = await parseRangeParam(searchParams);
  const dbClient = supabase as unknown as DbClient;
  const snapshot = await getDashboardSnapshot(dbClient, user.id, { rangeDays: selectedRange });
  const profilePlan = await getOrCreateProfilePlan(dbClient, user.id);
  const planConfig = getPlanConfigFromProfilePlan(profilePlan.plan);

  const usageItems: UsageLimitItem[] = [
    {
      id: "assets",
      label: "Varlıklar",
      used: snapshot.data.metrics.totalAssets,
      limit: planConfig.limits.assetsLimit,
    },
    {
      id: "documents",
      label: "Belgeler",
      used: snapshot.data.metrics.documentCount,
      limit: planConfig.limits.documentsLimit,
    },
    {
      id: "subscriptions",
      label: "Abonelikler",
      used: snapshot.data.metrics.subscriptionCount,
      limit: planConfig.limits.subscriptionsLimit,
    },
    {
      id: "invoices",
      label: "Fatura",
      used: snapshot.data.metrics.invoiceCount,
      limit: planConfig.limits.invoiceUploadsLimit,
    },
  ];

  return (
    <AppShell badge="Kontrol Merkezi" title="Kontrol Merkezi" subtitle={formatPanelDate(new Date())}>
      <div className="space-y-6 rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.13),transparent_56%)] p-2 sm:p-3">
        {snapshot.warning ? (
          <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {snapshot.warning}
          </p>
        ) : null}

        <ControlCenterHeader
          key={snapshot.data.status.risk.riskKey}
          selectedRange={selectedRange}
          status={snapshot.data.status}
        />

        <KPICards metrics={snapshot.data.metrics} trends={snapshot.data.trends} selectedRange={selectedRange} />

        <QuickActions />

        <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <RisksAndUpcoming riskPanel={snapshot.data.riskPanel} />
          <UsageLimitsCard
            planLabel={planConfig.label}
            isPremium={planConfig.code !== "starter"}
            items={usageItems}
          />
        </section>

        <RecentActivity activities={snapshot.data.recentActivity} />
      </div>
    </AppShell>
  );
}
