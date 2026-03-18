"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CostTrendLineChart } from "@/components/costs/cost-trend-line-chart";
import { YearlyCostBarChart } from "@/components/costs/yearly-cost-bar-chart";
import { usePlanContext } from "@/contexts/PlanContext";
import {
  type AssetCategory,
  buildCategoryCostSeries,
  buildMonthlyCostSeries,
  buildYearlyCostSeries,
  filterLogsByPeriod,
  type PeriodFilter,
  type ServiceCostLog,
} from "@/lib/charts";
import { isBillingMissingTableError } from "@/lib/billing/schema-guard";
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import {
  listByUser as listBillingInvoicesByUser,
  type ListBillingInvoicesByUserRow,
} from "@/lib/repos/billing-invoices-repo";
import {
  listByUser as listBillingSubscriptionsByUser,
  type ListBillingSubscriptionsByUserRow,
} from "@/lib/repos/billing-subscriptions-repo";
import { listForDocumentsPage, type ListDocumentsForDocumentsPageRow } from "@/lib/repos/documents-repo";
import { getCostAggregate, listForCosts, type ServiceLogCostAggregate } from "@/lib/repos/service-logs-repo";
import { calculateScoreAnalysis } from "@/lib/scoring/score-analysis";
import { createClient } from "@/lib/supabase/client";

type ServiceRow = ServiceCostLog & {
  id: string;
};

type AssetRow = AssetCategory & {
  name: string;
  purchase_price: number | null;
  warranty_end_date: string | null;
};

type MaintenanceRuleRow = {
  id: string;
  asset_id: string;
  next_due_date: string | null;
  last_service_date: string | null;
  is_active: boolean;
};

type ExpenseValueRow = {
  asset_id: string | null;
  amount: number | null;
  category: string | null;
  note: string | null;
  created_at: string;
};

type DocumentRow = ListDocumentsForDocumentsPageRow;
type BillingSubscriptionRow = ListBillingSubscriptionsByUserRow;
type BillingInvoiceRow = ListBillingInvoicesByUserRow;

type DateRange = {
  sinceDate?: string;
  beforeDate?: string;
};

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "3m", label: "Son 3 Ay" },
  { value: "6m", label: "Son 6 Ay" },
  { value: "12m", label: "Son 12 Ay" },
  { value: "this_year", label: "Bu Yıl" },
  { value: "all", label: "Tüm Dönem" },
];

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const toScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const selectClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const emptyCostAggregate: ServiceLogCostAggregate = {
  total_cost: 0,
  log_count: 0,
  avg_cost: 0,
  cost_score: 0,
};

const isSameCostAggregate = (left: ServiceLogCostAggregate, right: ServiceLogCostAggregate) =>
  left.total_cost === right.total_cost &&
  left.log_count === right.log_count &&
  left.avg_cost === right.avg_cost &&
  left.cost_score === right.cost_score;

const toDateInput = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPeriodRange = (period: PeriodFilter, now: Date): DateRange => {
  const beforeDate = toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
  if (period === "all") {
    return { beforeDate };
  }

  if (period === "this_year") {
    return {
      sinceDate: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))),
      beforeDate,
    };
  }

  const monthOffset = period === "3m" ? -2 : period === "6m" ? -5 : -11;
  return {
    sinceDate: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1))),
    beforeDate,
  };
};

const getCurrentYearRange = (now: Date): DateRange => ({
  sinceDate: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))),
  beforeDate: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))),
});

const getTrailingTwelveMonthRange = (now: Date): DateRange => ({
  sinceDate: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))),
  beforeDate: toDateInput(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))),
});

const isExpensesTableMissing = (error: { code?: string | null; message?: string } | null) => {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const normalized = (error.message ?? "").toLowerCase();
  return (
    normalized.includes("expenses") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table"))
  );
};

export default function CostsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { plan, userId: planUserId, isLoading: isPlanLoading } = usePlanContext();
  const planConfig = useMemo(() => getPlanConfigFromProfilePlan(plan), [plan]);
  const now = useMemo(() => new Date(), []);
  const initializedUserIdRef = useRef<string | null>(null);
  const periodAggregateInFlightRef = useRef(new Set<string>());

  const [activeUserId, setActiveUserId] = useState("");
  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [maintenanceRules, setMaintenanceRules] = useState<MaintenanceRuleRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [expenseValues, setExpenseValues] = useState<ExpenseValueRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<BillingSubscriptionRow[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoiceRow[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("12m");
  const [periodAggregate, setPeriodAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [currentYearAggregate, setCurrentYearAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [trailingTwelveAggregate, setTrailingTwelveAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const resetAnalyticsState = useCallback(() => {
    initializedUserIdRef.current = null;
    setActiveUserId((prev) => (prev === "" ? prev : ""));
    setLogs((prev) => (prev.length === 0 ? prev : []));
    setAssets((prev) => (prev.length === 0 ? prev : []));
    setMaintenanceRules((prev) => (prev.length === 0 ? prev : []));
    setDocuments((prev) => (prev.length === 0 ? prev : []));
    setExpenseValues((prev) => (prev.length === 0 ? prev : []));
    setSubscriptions((prev) => (prev.length === 0 ? prev : []));
    setInvoices((prev) => (prev.length === 0 ? prev : []));
    setPeriodAggregate((prev) => (isSameCostAggregate(prev, emptyCostAggregate) ? prev : emptyCostAggregate));
    setCurrentYearAggregate((prev) => (isSameCostAggregate(prev, emptyCostAggregate) ? prev : emptyCostAggregate));
    setTrailingTwelveAggregate((prev) =>
      isSameCostAggregate(prev, emptyCostAggregate) ? prev : emptyCostAggregate,
    );
  }, []);

  const loadAnalyticsForUser = useCallback(
    async (currentUserId: string) => {
      setActiveUserId((prev) => (prev === currentUserId ? prev : currentUserId));

      const [
        logsRes,
        assetsRes,
        rulesRes,
        documentsRes,
        subscriptionsRes,
        invoicesRes,
        expensesRes,
        currentYearRes,
        trailingTwelveRes,
      ] = await Promise.all([
        listForCosts(supabase, { userId: currentUserId }),
        supabase.from("assets").select("id,name,category,purchase_price,warranty_end_date").eq("user_id", currentUserId),
        supabase.from("maintenance_rules").select("id,asset_id,next_due_date,last_service_date,is_active").eq("user_id", currentUserId),
        listForDocumentsPage(supabase, { userId: currentUserId }),
        listBillingSubscriptionsByUser(supabase, { userId: currentUserId }),
        listBillingInvoicesByUser(supabase, { userId: currentUserId }),
        supabase.from("expenses").select("asset_id,amount,category,note,created_at").eq("user_id", currentUserId),
        getCostAggregate(supabase, { userId: currentUserId, ...getCurrentYearRange(now) }),
        getCostAggregate(supabase, { userId: currentUserId, ...getTrailingTwelveMonthRange(now) }),
      ]);

      if (logsRes.error) setFeedback(logsRes.error.message);
      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (rulesRes.error) setFeedback(rulesRes.error.message);
      if (documentsRes.error) setFeedback(documentsRes.error.message);
      if (currentYearRes.error) setFeedback(currentYearRes.error.message);
      if (trailingTwelveRes.error) setFeedback(trailingTwelveRes.error.message);
      if (expensesRes.error && !isExpensesTableMissing(expensesRes.error)) {
        setFeedback(expensesRes.error.message);
      }
      if (subscriptionsRes.error && !isBillingMissingTableError(subscriptionsRes.error, ["billing_subscriptions"])) {
        setFeedback(subscriptionsRes.error.message);
      }
      if (invoicesRes.error && !isBillingMissingTableError(invoicesRes.error, ["billing_invoices"])) {
        setFeedback(invoicesRes.error.message);
      }

      setLogs((logsRes.data ?? []) as ServiceRow[]);
      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setMaintenanceRules((rulesRes.data ?? []) as MaintenanceRuleRow[]);
      setDocuments((documentsRes.data ?? []) as DocumentRow[]);
      setExpenseValues(isExpensesTableMissing(expensesRes.error) ? [] : ((expensesRes.data ?? []) as ExpenseValueRow[]));
      setSubscriptions(
        isBillingMissingTableError(subscriptionsRes.error, ["billing_subscriptions"])
          ? []
          : ((subscriptionsRes.data ?? []) as BillingSubscriptionRow[]),
      );
      setInvoices(
        isBillingMissingTableError(invoicesRes.error, ["billing_invoices"])
          ? []
          : ((invoicesRes.data ?? []) as BillingInvoiceRow[]),
      );
      const nextCurrentYearAggregate = (currentYearRes.data ?? emptyCostAggregate) as ServiceLogCostAggregate;
      const nextTrailingTwelveAggregate = (trailingTwelveRes.data ?? emptyCostAggregate) as ServiceLogCostAggregate;
      setCurrentYearAggregate((prev) =>
        isSameCostAggregate(prev, nextCurrentYearAggregate) ? prev : nextCurrentYearAggregate,
      );
      setTrailingTwelveAggregate((prev) =>
        isSameCostAggregate(prev, nextTrailingTwelveAggregate) ? prev : nextTrailingTwelveAggregate,
      );
      setIsLoading(false);
    },
    [now, supabase],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      if (!planConfig.features.canUseAdvancedAnalytics) {
        resetAnalyticsState();
        setIsLoading(false);
        return;
      }

      const loadForUser = async (userId: string) => {
        if (initializedUserIdRef.current === userId) {
          setIsLoading(false);
          return;
        }
        initializedUserIdRef.current = userId;
        await loadAnalyticsForUser(userId);
      };

      if (planUserId) {
        await loadForUser(planUserId);
        return;
      }

      if (isPlanLoading) {
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (userError || !user) {
        resetAnalyticsState();
        setFeedback(userError?.message ?? "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      await loadForUser(user.id);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isPlanLoading, loadAnalyticsForUser, planConfig.features.canUseAdvancedAnalytics, planUserId, resetAnalyticsState, supabase]);

  useEffect(() => {
    if (!activeUserId || !planConfig.features.canUseAdvancedAnalytics) return;

    const loadPeriodAggregate = async () => {
      const requestKey = `${activeUserId}|${period}`;
      if (periodAggregateInFlightRef.current.has(requestKey)) {
        return;
      }
      periodAggregateInFlightRef.current.add(requestKey);

      try {
        const { data, error } = await getCostAggregate(supabase, {
          userId: activeUserId,
          ...getPeriodRange(period, now),
        });

        if (error) {
          setFeedback(error.message);
          return;
        }

        const nextAggregate = (data ?? emptyCostAggregate) as ServiceLogCostAggregate;
        setPeriodAggregate((prev) => (isSameCostAggregate(prev, nextAggregate) ? prev : nextAggregate));
      } finally {
        periodAggregateInFlightRef.current.delete(requestKey);
      }
    };

    void loadPeriodAggregate();
  }, [activeUserId, now, period, planConfig.features.canUseAdvancedAnalytics, supabase]);

  const filteredLogs = useMemo(() => filterLogsByPeriod(logs, period, now), [logs, period, now]);
  const monthlySeries = useMemo(() => buildMonthlyCostSeries(logs, period, now), [logs, period, now]);
  const yearlySeries = useMemo(() => buildYearlyCostSeries(logs), [logs]);
  const categorySeries = useMemo(() => buildCategoryCostSeries(filteredLogs, assets), [filteredLogs, assets]);
  const periodLabel = useMemo(
    () => periodOptions.find((option) => option.value === period)?.label ?? "Seçili dönem",
    [period],
  );
  const maxCategoryCost = useMemo(() => Math.max(1, ...categorySeries.map((item) => item.total)), [categorySeries]);
  const categoryRowsWithWidth = useMemo(
    () =>
      categorySeries.map((item) => ({
        ...item,
        width: Math.max(8, (item.total / maxCategoryCost) * 100),
      })),
    [categorySeries, maxCategoryCost],
  );

  const scoreAnalysis = useMemo(
    () =>
      calculateScoreAnalysis({
        assets: assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          purchasePrice: Number(asset.purchase_price ?? 0),
          warrantyEndDate: asset.warranty_end_date,
        })),
        maintenanceRules: maintenanceRules.map((rule) => ({
          id: rule.id,
          assetId: rule.asset_id,
          isActive: rule.is_active,
          nextDueDate: rule.next_due_date,
          lastServiceDate: rule.last_service_date,
        })),
        serviceLogs: logs.map((log) => ({
          assetId: log.asset_id,
          cost: Number(log.cost ?? 0),
        })),
        documents: documents.map((document) => ({
          assetId: document.asset_id,
        })),
        expenses: expenseValues.map((expense) => ({
          assetId: expense.asset_id,
          amount: Number(expense.amount ?? 0),
          category: expense.category,
          note: expense.note,
        })),
        subscriptions: subscriptions.map((subscription) => ({
          id: subscription.id,
          status: subscription.status,
          nextBillingDate: subscription.next_billing_date,
        })),
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          status: invoice.status,
          dueDate: invoice.due_date,
        })),
        now,
      }),
    [assets, documents, expenseValues, invoices, logs, maintenanceRules, now, subscriptions],
  );

  const scoreToneClass =
    scoreAnalysis.scoreLabel === "iyi"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : scoreAnalysis.scoreLabel === "orta"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : "border-rose-300/30 bg-rose-300/10 text-rose-100";

  const scoreRows = useMemo(() => {
    const barClassByKey: Record<string, string> = {
      "asset-data": "bg-gradient-to-r from-indigo-400 to-cyan-400",
      maintenance: "bg-gradient-to-r from-emerald-400 to-teal-500",
      warranty: "bg-gradient-to-r from-sky-400 to-blue-500",
      documents: "bg-gradient-to-r from-fuchsia-400 to-violet-500",
      cost: "bg-gradient-to-r from-amber-400 to-orange-500",
      billing: "bg-gradient-to-r from-pink-400 to-rose-500",
    };

    return scoreAnalysis.sections.map((section) => {
      const isCostInsufficientData =
        section.key === "cost" && !section.applicable && scoreAnalysis.costBreakdown.hasInsufficientData;

      return {
        key: section.key,
        label: section.label,
        score: toScore(section.score),
        note: isCostInsufficientData
          ? "Yeterli gerçek satın alma bedeli verisi olmadığı için bu bölüm şu an hesaplanamıyor."
          : section.summary,
        isApplicable: section.applicable,
        valueLabel: isCostInsufficientData ? "Yetersiz veri" : section.applicable ? undefined : "Uygulanmıyor",
        barClass: barClassByKey[section.key] ?? "bg-gradient-to-r from-slate-400 to-slate-300",
      };
    });
  }, [scoreAnalysis.costBreakdown.hasInsufficientData, scoreAnalysis.sections]);

  const warrantyItems = useMemo(() => {
    const total = Math.max(1, scoreAnalysis.assetMetrics.total);
    return [
      {
        key: "active",
        label: "Aktif garanti",
        count: scoreAnalysis.warrantyMetrics.active,
        score: toScore((scoreAnalysis.warrantyMetrics.active / total) * 100),
        barClass: "bg-gradient-to-r from-emerald-400 to-teal-400",
      },
      {
        key: "expiring",
        label: "Yakında bitecek",
        count: scoreAnalysis.warrantyMetrics.expiring,
        score: toScore((scoreAnalysis.warrantyMetrics.expiring / total) * 100),
        barClass: "bg-gradient-to-r from-amber-400 to-orange-400",
      },
      {
        key: "expired",
        label: "Süresi dolan",
        count: scoreAnalysis.warrantyMetrics.expired,
        score: toScore((scoreAnalysis.warrantyMetrics.expired / total) * 100),
        barClass: "bg-gradient-to-r from-rose-400 to-red-400",
      },
      {
        key: "unknown",
        label: "Tarihi girilmemiş",
        count: scoreAnalysis.warrantyMetrics.unknown,
        score: toScore((scoreAnalysis.warrantyMetrics.unknown / total) * 100),
        barClass: "bg-gradient-to-r from-slate-400 to-slate-300",
      },
    ];
  }, [
    scoreAnalysis.assetMetrics.total,
    scoreAnalysis.warrantyMetrics.active,
    scoreAnalysis.warrantyMetrics.expired,
    scoreAnalysis.warrantyMetrics.expiring,
    scoreAnalysis.warrantyMetrics.unknown,
  ]);

  return (
    <AppShell
      badge="Skor Analizi"
      title="Maliyet ve Skor"
      subtitle="Genel skor, mevcut varlık, bakım, garanti, belge, maliyet ve varsa fatura kayıtlarından; yalnızca yeterli veri olan alanlar kullanılarak hesaplanır."
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {!planConfig.features.canUseAdvancedAnalytics ? (
        <section className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Gelişmiş Analitik Kilidi</h2>
          <p className="mt-2 text-sm text-slate-300">
            Maliyet trendi, yıllık karşılaştırma ve maliyet/değer skor analizi {planConfig.label} planında kapalı.
            Pro plan ile aktif olur.
          </p>
        </section>
      ) : (
        <>
          <section className="premium-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Dönem Filtresi</h2>
                <p className="mt-1 text-sm text-slate-300">
                  Özet maliyetler seçili döneme göre güncellenir. Genel skor tüm mevcut kayıtlara göre ve yalnızca uygulanabilen alanlarla hesaplanır.
                </p>
              </div>
              <label className="block w-full sm:w-64">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Dönem</span>
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
                  className={selectClassName}
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-900">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={`${periodLabel} Toplamı`} value={currencyFormatter.format(periodAggregate.total_cost)} />
            <SummaryCard label="Bu Yıl Toplamı" value={currencyFormatter.format(currentYearAggregate.total_cost)} />
            <SummaryCard label="Son 12 Ay Toplamı" value={currencyFormatter.format(trailingTwelveAggregate.total_cost)} />
            <SummaryCard label="Genel Skor" value={`${scoreAnalysis.overallScore}/100`} />
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <article className="premium-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Skor Hesaplama Özeti</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Genel skor, yalnızca hesaplanabilen boyutların ağırlıklı ortalamasıdır. Yeterli veri olmayan boyutlar skora dahil edilmez.
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${scoreToneClass}`}>
                  {scoreAnalysis.scoreLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {scoreRows.map((item) => (
                  <ScoreProgressRow
                    key={item.key}
                    label={item.label}
                    score={item.score}
                    barClass={item.barClass}
                    note={item.note}
                    valueLabel={item.valueLabel}
                  />
                ))}
              </div>

              {scoreAnalysis.costBreakdown.hasInsufficientData ? (
                <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm text-amber-50">
                  Maliyet / değer bölümü, maliyeti olan varlıklar için yeterli satın alma bedeli bulunmadığında skora dahil edilmez.
                </div>
              ) : null}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <SummaryInline label="Varlık Sayısı" value={String(scoreAnalysis.assetMetrics.total)} />
                <SummaryInline
                  label="Bedeli Girilen"
                  value={`${scoreAnalysis.assetMetrics.withPurchasePrice}/${scoreAnalysis.assetMetrics.total}`}
                />
                <SummaryInline
                  label="Belgeli Varlık"
                  value={`${scoreAnalysis.documentMetrics.documentedAssets}/${scoreAnalysis.assetMetrics.total}`}
                />
                <SummaryInline
                  label="Geciken Bakım / Fatura"
                  value={`${scoreAnalysis.maintenanceMetrics.overdueRules} / ${scoreAnalysis.billingMetrics.overdueInvoices}`}
                />
              </div>

              <p className="mt-4 text-xs text-slate-400">
                {scoreAnalysis.emptyState?.description ??
                  "Satın alma bedeli, garanti tarihi, belge, bakım kuralı ve fatura durumu gibi kayıtlar ilgili alt skorları doğrudan etkiler."}
              </p>
            </article>

            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">İyileştirme Önerileri</h2>
              <p className="mt-1 text-sm text-slate-300">Skoru gerçek kayıtlara göre en hızlı iyileştirecek alanlar.</p>

              {scoreAnalysis.emptyState ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
                  <p className="text-sm font-semibold text-white">{scoreAnalysis.emptyState.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{scoreAnalysis.emptyState.description}</p>
                </div>
              ) : scoreAnalysis.suggestions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-300">Kritik iyileştirme önerisi bulunmuyor. Kayıtlar şu an tutarlı görünüyor.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {scoreAnalysis.suggestions.map((item) => (
                    <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200">
                      {item.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 space-y-3">
                {warrantyItems.map((item) => (
                  <ScoreProgressRow
                    key={item.key}
                    label={item.label}
                    score={item.score}
                    barClass={item.barClass}
                    note={`${item.count} varlık`}
                  />
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">{periodLabel} Maliyet Trendi</h2>
              <p className="mt-1 text-sm text-slate-300">Aylık servis maliyeti dağılımı.</p>
              {isLoading ? (
                <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
              ) : logs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-300">Grafik için servis verisi bulunmuyor.</p>
              ) : (
                <div className="mt-4 h-72">
                  <CostTrendLineChart points={monthlySeries} />
                </div>
              )}
            </article>

            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">Yıllık Toplam Karşılaştırması</h2>
              <p className="mt-1 text-sm text-slate-300">Yıllara göre toplam servis maliyeti.</p>
              {isLoading ? (
                <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
              ) : yearlySeries.length === 0 ? (
                <p className="mt-4 text-sm text-slate-300">Yıllık maliyet verisi bulunmuyor.</p>
              ) : (
                <div className="mt-4 h-72">
                  <YearlyCostBarChart points={yearlySeries} />
                </div>
              )}
            </article>
          </section>

          <CategoryDistributionCard
            isLoading={isLoading}
            rows={categoryRowsWithWidth}
            formatter={currencyFormatter}
          />
        </>
      )}
    </AppShell>
  );
}

const CategoryDistributionCard = memo(function CategoryDistributionCard({
  isLoading,
  rows,
  formatter,
}: {
  isLoading: boolean;
  rows: Array<{ label: string; total: number; width: number }>;
  formatter: Intl.NumberFormat;
}) {
  return (
    <section className="premium-card p-5">
      <h2 className="text-lg font-semibold text-white">Seçili Dönem Kategori Dağılımı</h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">Seçili dönemde maliyet kaydı bulunmuyor.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{item.label}</span>
                <span>{formatter.format(item.total)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500"
                  style={{ width: `${item.width}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

function ScoreProgressRow({
  label,
  score,
  barClass,
  note,
  valueLabel,
}: {
  label: string;
  score: number;
  barClass: string;
  note?: string;
  valueLabel?: string;
}) {
  const width = score > 0 ? Math.max(4, score) : 0;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-300">{label}</div>
          {note ? <div className="mb-2 text-[11px] text-slate-400">{note}</div> : null}
          <div className="relative z-10 h-2 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-white/10">
            <div className={`absolute inset-y-0 left-0 z-20 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
          </div>
        </div>
        <span className="text-xs font-semibold text-white">{valueLabel ?? `${score}/100`}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

function SummaryInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}
