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
import {
  DashboardRecentActivity,
} from "@/features/dashboard/components/dashboard-recent-activity";
import {
  DashboardRiskCards,
  type DashboardMonthlyExpenseWarning,
  type DashboardPredictionItem,
  type DashboardUpcomingSubscriptionCharge,
} from "@/features/dashboard/components/dashboard-risk-cards";
import { createClient } from "@/lib/supabase/client";

type AssetRow = DashboardChartAssetRow;

type ServiceLogRow = DashboardChartServiceLogRow;

type RuleRow = DashboardChartRuleRow;

type DocumentRow = {
  id: string;
};

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

const parseDateOnly = (value: string) => {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
};

export function DashboardPageContainer() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLogRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [predictionMeta, setPredictionMeta] = useState<{
    generatedAt: string;
    model: string;
    warning?: string;
  } | null>(null);
  const [predictionError, setPredictionError] = useState("");

  const clearClientState = () => {
    setEmail("");
    setIsLoading(false);
    setFeedback("");
    setAssets([]);
    setServiceLogs([]);
    setRules([]);
    setDocuments([]);
    setSubscriptions([]);
    setExpenses([]);
    setPredictions([]);
    setPredictionMeta(null);
    setPredictionError("");
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");
      setPredictionError("");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        setFeedback("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      const predictionRequest = fetch("/api/maintenance-predictions", {
        method: "GET",
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as
            | PredictionApiResponse
            | { error?: string }
            | null;

          if (!response.ok) {
            throw new Error(
              body && "error" in body
                ? body.error || "Tahmin verisi alınamadı."
                : "Tahmin verisi alınamadı.",
            );
          }

          return body as PredictionApiResponse;
        })
        .then((data) => ({ data, error: "" }))
        .catch((error: Error) => ({ data: null, error: error.message }));

      const [assetsRes, logsRes, rulesRes, docsRes, subscriptionsRes, expensesRes, predictionRes] =
        await Promise.all([
        supabase.from("assets").select("id,name,category,warranty_end_date").eq("user_id", user.id),
        supabase
          .from("service_logs")
          .select("id,asset_id,rule_id,service_type,service_date,cost")
          .eq("user_id", user.id),
        supabase
          .from("maintenance_rules")
          .select("id,asset_id,next_due_date,is_active")
          .eq("user_id", user.id),
        supabase.from("documents").select("id").eq("user_id", user.id),
        supabase
          .from("billing_subscriptions")
          .select("id,provider_name,subscription_name,amount,currency,next_billing_date,status")
          .eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("id,amount,currency,expense_date")
          .eq("user_id", user.id),
        predictionRequest,
        ]);

      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (logsRes.error) setFeedback(logsRes.error.message);
      if (rulesRes.error) setFeedback(rulesRes.error.message);
      if (docsRes.error) setFeedback(docsRes.error.message);
      if (subscriptionsRes.error) setFeedback(subscriptionsRes.error.message);
      if (expensesRes.error) setFeedback(expensesRes.error.message);

      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setServiceLogs((logsRes.data ?? []) as ServiceLogRow[]);
      setRules((rulesRes.data ?? []) as RuleRow[]);
      setDocuments((docsRes.data ?? []) as DocumentRow[]);
      setSubscriptions((subscriptionsRes.data ?? []) as SubscriptionRow[]);
      setExpenses((expensesRes.data ?? []) as ExpenseRow[]);
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

      setIsLoading(false);
    };

    void load();
  }, [supabase]);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    clearClientState();
  };

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const upcomingDueCount = useMemo(() => {
    const inSevenDays = new Date(today);
    inSevenDays.setDate(today.getDate() + 7);

    return rules.filter((rule) => {
      if (!rule.is_active || !rule.next_due_date) return false;
      const dueDate = parseDateOnly(rule.next_due_date);
      if (!dueDate) return false;
      return dueDate >= today && dueDate <= inSevenDays;
    }).length;
  }, [rules, today]);

  const overdueCount = useMemo(() => {
    return rules.filter((rule) => {
      if (!rule.is_active || !rule.next_due_date) return false;
      const dueDate = parseDateOnly(rule.next_due_date);
      if (!dueDate) return false;
      return dueDate < today;
    }).length;
  }, [rules, today]);

  const upcomingWarrantyCount = useMemo(() => {
    const inThirtyDays = new Date(today);
    inThirtyDays.setDate(today.getDate() + 30);

    return assets.filter((asset) => {
      if (!asset.warranty_end_date) return false;
      const warrantyEndDate = parseDateOnly(asset.warranty_end_date);
      if (!warrantyEndDate) return false;
      return warrantyEndDate >= today && warrantyEndDate <= inThirtyDays;
    }).length;
  }, [assets, today]);

  const thisMonthCost = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return serviceLogs
      .filter((log) => {
        const d = new Date(log.service_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  }, [serviceLogs]);

  const topPredictions = useMemo(
    () => [...predictions].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6),
    [predictions],
  );

  const highRiskCount = useMemo(
    () => predictions.filter((item) => item.riskScore >= 70).length,
    [predictions],
  );

  const predictionGeneratedAt = useMemo(() => {
    if (!predictionMeta?.generatedAt) return "";
    const parsed = new Date(predictionMeta.generatedAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("tr-TR");
  }, [predictionMeta]);

  const upcomingSubscriptionCharges = useMemo<DashboardUpcomingSubscriptionCharge[]>(() => {
    const inThirtyDays = new Date(today);
    inThirtyDays.setDate(today.getDate() + 30);

    return subscriptions
      .filter((subscription) => {
        if (subscription.status !== "active" || !subscription.next_billing_date) return false;
        const billingDate = parseDateOnly(subscription.next_billing_date);
        if (!billingDate) return false;
        return billingDate >= today && billingDate <= inThirtyDays;
      })
      .sort((a, b) => {
        const aDate = parseDateOnly(a.next_billing_date ?? "")?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = parseDateOnly(b.next_billing_date ?? "")?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      })
      .slice(0, 4)
      .map((subscription) => ({
        id: subscription.id,
        providerName: subscription.provider_name,
        subscriptionName: subscription.subscription_name,
        nextBillingDate: subscription.next_billing_date ?? "",
        amount: Number(subscription.amount ?? 0),
        currency: subscription.currency || "TRY",
      }));
  }, [subscriptions, today]);

  const monthlyExpenseWarning = useMemo<DashboardMonthlyExpenseWarning>(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const threshold = 5000;
    const total = expenses
      .filter((expense) => {
        const expenseDate = parseDateOnly(expense.expense_date);
        if (!expenseDate) return false;
        return expenseDate.getMonth() === month && expenseDate.getFullYear() === year;
      })
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

    return {
      isHigh: total >= threshold,
      total,
      threshold,
      currency: "TRY",
    };
  }, [expenses]);

  return (
    <AppShell
      badge="Kontrol Merkezi"
      title="Gösterge Paneli"
      subtitle={
        isLoading
          ? "Veriler yükleniyor..."
          : `Hoş geldiniz, ${email || "kullanıcı"}. Bu ekran gerçek verilerinizle güncellenir.`
      }
      actions={
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Çıkış Yap
        </button>
      }
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {predictionError ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          AI tahmin servisi şu anda kullanılamıyor: {predictionError}
        </p>
      ) : null}

      <DashboardKpiSection
        assetCount={String(assets.length)}
        upcomingDueCount={String(upcomingDueCount)}
        overdueCount={String(overdueCount)}
        upcomingWarrantyCount={String(upcomingWarrantyCount)}
        thisMonthCost={`${thisMonthCost.toFixed(2)} TL`}
        highRiskCount={String(highRiskCount)}
      />

      <DashboardChartsSection assets={assets} serviceLogs={serviceLogs} rules={rules} isLoading={isLoading} />

      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <DashboardRecentActivity
          serviceLogCount={String(serviceLogs.length)}
          documentCount={String(documents.length)}
          categoryCount={String(new Set(assets.map((asset) => asset.category)).size)}
        />

        <DashboardRiskCards
          isLoading={isLoading}
          topPredictions={topPredictions}
          predictionMeta={predictionMeta}
          predictionGeneratedAt={predictionGeneratedAt}
          upcomingSubscriptionCharges={upcomingSubscriptionCharges}
          monthlyExpenseWarning={monthlyExpenseWarning}
        />
      </section>
    </AppShell>
  );
}
