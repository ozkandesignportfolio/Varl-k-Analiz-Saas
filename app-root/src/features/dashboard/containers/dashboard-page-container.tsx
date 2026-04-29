import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getDashboardSnapshot, parseDashboardDateRange } from "@/features/dashboard/api/dashboard-queries";
import { DashboardContent } from "@/features/dashboard/containers/DashboardContent";
import { DashboardRangeProvider } from "@/features/dashboard/context/DashboardRangeContext";
import { getOrCreateProfilePlan, getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import type { DbClient } from "@/lib/repos/_shared";
import { isSupabaseUserEmailConfirmed } from "@/lib/supabase/auth-errors";
import { buildLoginPath } from "@/lib/supabase/email-verification";
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

const getFirstSearchParam = (value: SearchParamValue) => (Array.isArray(value) ? value[0] : value);

const parseDashboardPageState = async (searchParams?: DashboardPageSearchParams) => {
  const resolved = (await Promise.resolve(searchParams ?? {})) as Record<string, SearchParamValue>;
  return {
    selectedRange: parseDashboardDateRange(getFirstSearchParam(resolved.range)),
    showEmailVerificationSuccess: getFirstSearchParam(resolved.email_verified) === "1",
  };
};

export async function DashboardPageContainer({ searchParams }: DashboardPageContainerProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginPath("/dashboard"));
  }

  if (!isSupabaseUserEmailConfirmed(user)) {
    redirect(
      buildLoginPath("/dashboard", {
        email: user.email ?? null,
        emailVerificationRequired: true,
      }),
    );
  }

  const { selectedRange, showEmailVerificationSuccess } = await parseDashboardPageState(searchParams);
  const dbClient = supabase as unknown as DbClient;
  const [snapshot, profilePlan] = await Promise.all([
    getDashboardSnapshot(dbClient, user.id, { rangeDays: selectedRange }),
    getOrCreateProfilePlan(dbClient, user.id),
  ]);
  const planConfig = getPlanConfigFromProfilePlan(profilePlan.plan);

  return (
    <AppShell badge="Kontrol Merkezi" title="Kontrol Merkezi" subtitle={formatPanelDate(new Date())}>
      <DashboardRangeProvider
        initialRange={selectedRange}
        initialSnapshot={snapshot}
        userId={user.id}
      >
        <DashboardContent
          userId={user.id}
          planLabel={planConfig.label}
          planCode={planConfig.code}
          planLimits={{
            assetsLimit: planConfig.limits.assetsLimit,
            documentsLimit: planConfig.limits.documentsLimit,
            subscriptionsLimit: planConfig.limits.subscriptionsLimit,
            invoiceUploadsLimit: planConfig.limits.invoiceUploadsLimit,
          }}
          showEmailVerificationSuccess={showEmailVerificationSuccess}
        />
      </DashboardRangeProvider>
    </AppShell>
  );
}
