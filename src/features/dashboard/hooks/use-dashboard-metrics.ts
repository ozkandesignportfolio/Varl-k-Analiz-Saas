import { useMemo } from "react";
import type {
  DashboardMonthlyExpenseWarning,
  DashboardPredictionItem,
  DashboardUpcomingSubscriptionCharge,
} from "@/features/dashboard/components/dashboard-risk-cards";

type AssetRow = {
  category: string;
  warranty_end_date: string | null;
};

type ServiceLogRow = {
  service_date: string;
  cost: number;
};

type RuleRow = {
  next_due_date: string;
  is_active: boolean;
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
  amount: number;
  expense_date: string;
};

type PredictionMeta = {
  generatedAt: string;
};

const parseDateOnly = (value: string) => {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
};

export function useDashboardMetrics(params: {
  assets: AssetRow[];
  serviceLogs: ServiceLogRow[];
  rules: RuleRow[];
  predictions: DashboardPredictionItem[];
  predictionMeta: PredictionMeta | null;
  subscriptions: SubscriptionRow[];
  expenses: ExpenseRow[];
}) {
  const { assets, expenses, predictionMeta, predictions, rules, serviceLogs, subscriptions } = params;
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

  return {
    upcomingDueCount,
    overdueCount,
    upcomingWarrantyCount,
    thisMonthCost,
    topPredictions,
    highRiskCount,
    predictionGeneratedAt,
    upcomingSubscriptionCharges,
    monthlyExpenseWarning,
  };
}
