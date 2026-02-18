"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DashboardChartsSection,
  type DashboardChartAssetRow,
  type DashboardChartRuleRow,
  type DashboardChartServiceLogRow,
} from "@/features/dashboard/components/dashboard-charts-section";
import { DashboardKpiSection } from "@/features/dashboard/components/dashboard-kpi-section";
import { DashboardRecentActivity } from "@/features/dashboard/components/dashboard-recent-activity";
import { DashboardRiskCards, type DashboardPredictionItem } from "@/features/dashboard/components/dashboard-risk-cards";
import { useDashboardMetrics } from "@/features/dashboard/hooks/use-dashboard-metrics";
import { safeExpensesReadQuery, type ExpensesTableWarning } from "@/features/expenses/lib/expenses-query-guard";
import { getPlanConfig, getUserPlanConfig, type PlanConfig } from "@/lib/plans/plan-config";
import { countByUser as countDocumentsByUser } from "@/lib/repos/documents-repo";
import { listForDashboard as listRulesForDashboard } from "@/lib/repos/maintenance-rules-repo";
import { listForDashboard as listServiceLogsForDashboard } from "@/lib/repos/service-logs-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AssetRow = DashboardChartAssetRow;
type ServiceLogRow = DashboardChartServiceLogRow;
type RuleRow = DashboardChartRuleRow;

type SubscriptionRow = {
  id: string;
  provider_name: string;
  subscription_name: string;
  amount: number;
  currency: string;
  next_billing_date: string | null;
  status: "active" | "paused" | "cancelled";
};

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  expense_date: string;
};

type PredictionItem = DashboardPredictionItem;

type PredictionApiResponse = {
  generatedAt: string;
  model: string;
  warning?: string;
  items: PredictionItem[];
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateRangeStarts = () => {
  const now = new Date();
  const dashboardRangeStart = new Date(now);
  dashboardRangeStart.setMonth(dashboardRangeStart.getMonth() - 12);

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(now.getDate() + 30);

  return {
    dashboardStartDate: toDateInput(dashboardRangeStart),
    currentMonthStartDate: toDateInput(currentMonthStart),
    nextMonthStartDate: toDateInput(nextMonthStart),
    todayDate: toDateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
    thirtyDaysLaterDate: toDateInput(thirtyDaysLater),
  };
};

const DEFAULT_PLAN_CONFIG: PlanConfig = getPlanConfig("starter");

export function DashboardPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [planConfig, setPlanConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLogRow[]>([]);
  const [serviceLogCount, setServiceLogCount] = useState(0);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseTableWarning, setExpenseTableWarning] = useState<ExpensesTableWarning | null>(null);

  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [predictionMeta, setPredictionMeta] = useState<{
    generatedAt: string;
    model: string;
    warning?: string;
  } | null>(null);
  const [predictionError, setPredictionError] = useState("");

  const clearClientState = () => {
    setEmail("");
    setHasValidSession(false);
    setIsLoading(false);
    setFeedback("");
    setAssets([]);
    setServiceLogs([]);
    setServiceLogCount(0);
    setRules([]);
    setDocumentCount(0);
    setSubscriptions([]);
    setExpenses([]);
    setExpenseTableWarning(null);
    setPredictions([]);
    setPredictionMeta(null);
    setPredictionError("");
    setPlanConfig(DEFAULT_PLAN_CONFIG);
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");
      setPredictionError("");
      setExpenseTableWarning(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasValidSession(false);
        router.replace("/login");
        setIsLoading(false);
        return;
      }

      setHasValidSession(true);
      setEmail(user.email ?? "");

      const userPlan = getUserPlanConfig(user);
      setPlanConfig(userPlan);
      const canUseAdvancedAnalytics = userPlan.features.canUseAdvancedAnalytics;

      const {
        currentMonthStartDate,
        dashboardStartDate,
        nextMonthStartDate,
        thirtyDaysLaterDate,
        todayDate,
      } = getDateRangeStarts();

      const predictionRequest = canUseAdvancedAnalytics
        ? fetch("/api/maintenance-predictions", {
            method: "GET",
            headers: { Accept: "application/json" },
          })
            .then(async (response) => {
              const body = (await response.json().catch(() => null)) as PredictionApiResponse | { error?: string } | null;

              if (!response.ok) {
                throw new Error(
                  body && "error" in body ? body.error || "Tahmin verisi alinamadi." : "Tahmin verisi alinamadi.",
                );
              }

              return body as PredictionApiResponse;
            })
            .then((data) => ({ data, error: "" }))
            .catch((error: Error) => ({ data: null, error: error.message }))
        : Promise.resolve({ data: null, error: "" });

      const coreDataPromise = Promise.all([
        supabase.from("assets").select("id,name,category,warranty_end_date").eq("user_id", user.id),
        listServiceLogsForDashboard(supabase, {
          userId: user.id,
          sinceDate: dashboardStartDate,
          limit: 1500,
        }),
        supabase.from("service_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        listRulesForDashboard(supabase, {
          userId: user.id,
          onlyActive: true,
        }),
        countDocumentsByUser(supabase, { userId: user.id }),
      ]);

      const financeDataPromise = Promise.all([
        supabase
          .from("billing_subscriptions")
          .select("id,provider_name,subscription_name,amount,currency,next_billing_date,status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .gte("next_billing_date", todayDate)
          .lte("next_billing_date", thirtyDaysLaterDate)
          .order("next_billing_date", { ascending: true })
          .limit(12),
        (async () => {
          const expensesQueryResult = await supabase
            .from("expenses")
            .select("id,amount,currency,expense_date")
            .eq("user_id", user.id)
            .gte("expense_date", currentMonthStartDate)
            .lt("expense_date", nextMonthStartDate)
            .order("expense_date", { ascending: false });

          return safeExpensesReadQuery<ExpenseRow>(
            Promise.resolve(expensesQueryResult),
            "dashboard.finance.expenses",
          );
        })(),
      ]);

      const [[assetsRes, logsRes, logCountRes, rulesRes, docsRes], [subscriptionsRes, expensesRes], predictionRes] =
        await Promise.all([coreDataPromise, financeDataPromise, predictionRequest]);

      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (logsRes.error) setFeedback(logsRes.error.message);
      if (logCountRes.error) setFeedback(logCountRes.error.message);
      if (rulesRes.error) setFeedback(rulesRes.error.message);
      if (docsRes.error) setFeedback(docsRes.error.message);
      if (subscriptionsRes.error) setFeedback(subscriptionsRes.error.message);
      if (expensesRes.error) setFeedback(expensesRes.error.message);
      if (expensesRes.warning) setExpenseTableWarning(expensesRes.warning);

      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setServiceLogs((logsRes.data ?? []) as ServiceLogRow[]);
      setServiceLogCount(logCountRes.count ?? 0);
      setRules((rulesRes.data ?? []) as RuleRow[]);
      setDocumentCount(docsRes.data ?? 0);
      setSubscriptions((subscriptionsRes.data ?? []) as SubscriptionRow[]);
      setExpenses(expensesRes.data);

      if (canUseAdvancedAnalytics) {
        setPredictions((predictionRes.data?.items ?? []) as PredictionItem[]);
        setPredictionMeta(
          predictionRes.data
            ? {
                generatedAt: predictionRes.data.generatedAt,
                model: predictionRes.data.model,
                warning: predictionRes.data.warning,
              }
            : null,
        );
        if (predictionRes.error) {
          setPredictionError(predictionRes.error);
        }
      } else {
        setPredictions([]);
        setPredictionMeta(null);
        setPredictionError("");
      }

      setIsLoading(false);
    };

    void load();
  }, [router, supabase]);

  const onSignOut = async () => {
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login");
    router.refresh();
    clearClientState();
  };

  const {
    upcomingDueCount,
    overdueCount,
    upcomingWarrantyCount,
    thisMonthCost,
    topPredictions,
    highRiskCount,
    predictionGeneratedAt,
    upcomingSubscriptionCharges,
    monthlyExpenseWarning,
  } = useDashboardMetrics({
    assets,
    serviceLogs,
    rules,
    predictions,
    predictionMeta,
    subscriptions,
    expenses,
  });

  if (!hasValidSession) {
    return null;
  }

  return (
    <AppShell
      badge="Kontrol Merkezi"
      title="Gosterge Paneli"
      subtitle={isLoading ? "Veriler yukleniyor..." : `Hos geldiniz, ${email || "kullanici"}. Bu ekran gercek verilerinizle guncellenir.`}
      actions={
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Cikis Yap
        </button>
      }
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {expenseTableWarning ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          Gider tablosu su an erisilebilir degil. Gider widget verileri bos gosteriliyor. ({expenseTableWarning.code})
        </p>
      ) : null}

      {!planConfig.features.canUseAdvancedAnalytics ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          Gelismis analitik grafikler ve AI bakim riskleri {planConfig.label} planinda kapali. Pro plan ile aktif olur.
        </p>
      ) : null}

      {planConfig.features.canUseAdvancedAnalytics && predictionError ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          AI tahmin servisi su anda kullanilamiyor: {predictionError}
        </p>
      ) : null}

      <DashboardKpiSection
        assetCount={String(assets.length)}
        upcomingDueCount={String(upcomingDueCount)}
        overdueCount={String(overdueCount)}
        upcomingWarrantyCount={String(upcomingWarrantyCount)}
        thisMonthCost={`${thisMonthCost.toFixed(2)} TL`}
        highRiskCount={planConfig.features.canUseAdvancedAnalytics ? String(highRiskCount) : "-"}
      />

      {planConfig.features.canUseAdvancedAnalytics ? (
        <DashboardChartsSection assets={assets} serviceLogs={serviceLogs} rules={rules} isLoading={isLoading} />
      ) : (
        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Gelismis Grafikler Kilitli</h2>
          <p className="mt-2 text-sm text-slate-300">
            12 aylik maliyet trendi, varlik performans karsilastirma ve bakim oncelik panosu Pro plan ozelligidir.
          </p>
        </article>
      )}

      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <DashboardRecentActivity
          serviceLogCount={String(serviceLogCount)}
          documentCount={String(documentCount)}
          categoryCount={String(new Set(assets.map((asset) => asset.category)).size)}
        />

        {planConfig.features.canUseAdvancedAnalytics ? (
          <DashboardRiskCards
            isLoading={isLoading}
            topPredictions={topPredictions}
            predictionMeta={predictionMeta}
            predictionGeneratedAt={predictionGeneratedAt}
            upcomingSubscriptionCharges={upcomingSubscriptionCharges}
            monthlyExpenseWarning={monthlyExpenseWarning}
          />
        ) : (
          <article className="premium-card p-5">
            <h2 className="text-lg font-semibold text-white">AI Risk Kartlari Kilitli</h2>
            <p className="mt-2 text-sm text-slate-300">
              AI bakim risk puanlari ve onerilen aksiyonlar Pro plan ile kullanilabilir.
            </p>
          </article>
        )}
      </section>
    </AppShell>
  );
}
