"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import { getCostAggregate, listForCosts, type ServiceLogCostAggregate } from "@/lib/repos/service-logs-repo";
import { calculateRatioScore } from "@/lib/scoring/ratio-score";
import { createClient } from "@/lib/supabase/client";

type ServiceRow = ServiceCostLog & {
  id: string;
};

type AssetRow = AssetCategory & {
  name: string;
  warranty_end_date: string | null;
};

type MaintenanceRuleRow = {
  id: string;
  next_due_date: string;
  is_active: boolean;
};

type ExpenseValueRow = {
  asset_id: string | null;
  amount: number | null;
  category: string | null;
  note: string | null;
  created_at: string;
};

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

const toDateInput = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
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
  const { plan } = usePlanContext();
  const planConfig = useMemo(() => getPlanConfigFromProfilePlan(plan), [plan]);
  const now = useMemo(() => new Date(), []);

  const [activeUserId, setActiveUserId] = useState("");
  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [maintenanceRules, setMaintenanceRules] = useState<MaintenanceRuleRow[]>([]);
  const [expenseValues, setExpenseValues] = useState<ExpenseValueRow[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("12m");
  const [periodAggregate, setPeriodAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [currentYearAggregate, setCurrentYearAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [trailingTwelveAggregate, setTrailingTwelveAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFeedback(userError?.message ?? "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      if (!planConfig.features.canUseAdvancedAnalytics) {
        setLogs([]);
        setAssets([]);
        setMaintenanceRules([]);
        setExpenseValues([]);
        setPeriodAggregate(emptyCostAggregate);
        setCurrentYearAggregate(emptyCostAggregate);
        setTrailingTwelveAggregate(emptyCostAggregate);
        setIsLoading(false);
        return;
      }

      setActiveUserId(user.id);

      const [logsRes, assetsRes, rulesRes, expensesRes, currentYearRes, trailingTwelveRes] = await Promise.all([
        listForCosts(supabase, { userId: user.id }),
        supabase.from("assets").select("id,name,category,warranty_end_date").eq("user_id", user.id),
        supabase.from("maintenance_rules").select("id,next_due_date,is_active").eq("user_id", user.id),
        supabase.from("expenses").select("asset_id,amount,category,note,created_at").eq("user_id", user.id),
        getCostAggregate(supabase, { userId: user.id, ...getCurrentYearRange(now) }),
        getCostAggregate(supabase, { userId: user.id, ...getTrailingTwelveMonthRange(now) }),
      ]);

      if (logsRes.error) setFeedback(logsRes.error.message);
      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (rulesRes.error) setFeedback(rulesRes.error.message);
      if (currentYearRes.error) setFeedback(currentYearRes.error.message);
      if (trailingTwelveRes.error) setFeedback(trailingTwelveRes.error.message);
      if (expensesRes.error && !isExpensesTableMissing(expensesRes.error)) {
        setFeedback(expensesRes.error.message);
      }

      setLogs((logsRes.data ?? []) as ServiceRow[]);
      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setMaintenanceRules((rulesRes.data ?? []) as MaintenanceRuleRow[]);
      setExpenseValues(isExpensesTableMissing(expensesRes.error) ? [] : ((expensesRes.data ?? []) as ExpenseValueRow[]));
      setCurrentYearAggregate((currentYearRes.data ?? emptyCostAggregate) as ServiceLogCostAggregate);
      setTrailingTwelveAggregate((trailingTwelveRes.data ?? emptyCostAggregate) as ServiceLogCostAggregate);
      setIsLoading(false);
    };

    void load();
  }, [now, planConfig.features.canUseAdvancedAnalytics, supabase]);

  useEffect(() => {
    if (!activeUserId || !planConfig.features.canUseAdvancedAnalytics) return;

    const loadPeriodAggregate = async () => {
      const { data, error } = await getCostAggregate(supabase, {
        userId: activeUserId,
        ...getPeriodRange(period, now),
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setPeriodAggregate((data ?? emptyCostAggregate) as ServiceLogCostAggregate);
    };

    void loadPeriodAggregate();
  }, [activeUserId, now, period, planConfig.features.canUseAdvancedAnalytics, supabase]);

  const filteredLogs = useMemo(() => filterLogsByPeriod(logs, period, now), [logs, period, now]);
  const monthlySeries = useMemo(() => buildMonthlyCostSeries(logs, period, now), [logs, period, now]);
  const yearlySeries = useMemo(() => buildYearlyCostSeries(logs), [logs]);
  const categorySeries = useMemo(() => buildCategoryCostSeries(filteredLogs, assets), [filteredLogs, assets]);
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? "Seçili dönem";
  const maxCategoryCost = useMemo(() => Math.max(1, ...categorySeries.map((item) => item.total)), [categorySeries]);

  const ratioBreakdown = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const activeRuleCount = maintenanceRules.filter((rule) => rule.is_active).length;
    const overdueRuleCount = maintenanceRules.filter((rule) => {
      if (!rule.is_active) return false;
      const due = parseDateOnly(rule.next_due_date);
      if (!due) return false;
      return due < today;
    }).length;

    return calculateRatioScore({
      assets: assets.map((asset) => ({ id: asset.id, name: asset.name })),
      logs: filteredLogs.map((log) => ({ assetId: log.asset_id, cost: Number(log.cost ?? 0) })),
      expenses: expenseValues.map((expense) => ({
        assetId: expense.asset_id,
        amount: Number(expense.amount ?? 0),
        category: expense.category,
        note: expense.note,
      })),
      rules: {
        activeRuleCount,
        overdueRuleCount,
      },
    });
  }, [assets, expenseValues, filteredLogs, maintenanceRules, now]);

  const scoreToneClass =
    ratioBreakdown.scoreLabel === "iyi"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : ratioBreakdown.scoreLabel === "orta"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : "border-rose-300/30 bg-rose-300/10 text-rose-100";

  const scoreRows = useMemo(() => {
    const maintenanceShare = ratioBreakdown.totalCost > 0 ? (ratioBreakdown.totalMaintenanceCost / ratioBreakdown.totalCost) * 100 : 0;
    const expenseShare = ratioBreakdown.totalCost > 0 ? (ratioBreakdown.totalExpenseCost / ratioBreakdown.totalCost) * 100 : 0;

    return [
      {
        key: "composite",
        label: "Birleşik Skor",
        score: toScore(ratioBreakdown.score),
        barClass: "bg-gradient-to-r from-indigo-400 to-cyan-400",
      },
      {
        key: "ratio",
        label: "Fiyat / Maliyet Oranı",
        score: toScore(ratioBreakdown.baseScore),
        barClass: "bg-gradient-to-r from-sky-400 to-blue-500",
      },
      {
        key: "maintenance-share",
        label: "Bakım Maliyet Payı",
        score: toScore(maintenanceShare),
        barClass: "bg-gradient-to-r from-emerald-400 to-teal-500",
      },
      {
        key: "expense-share",
        label: "Harcama Maliyet Payı",
        score: toScore(expenseShare),
        barClass: "bg-gradient-to-r from-amber-400 to-orange-500",
      },
    ];
  }, [ratioBreakdown.baseScore, ratioBreakdown.score, ratioBreakdown.totalCost, ratioBreakdown.totalExpenseCost, ratioBreakdown.totalMaintenanceCost]);

  const warrantyItems = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inThirtyDays = new Date(today);
    inThirtyDays.setDate(today.getDate() + 30);

    let active = 0;
    let expiring = 0;
    let expired = 0;
    let unknown = 0;

    for (const asset of assets) {
      const warrantyEnd = parseDateOnly(asset.warranty_end_date);
      if (!warrantyEnd) {
        unknown += 1;
        continue;
      }
      if (warrantyEnd < today) {
        expired += 1;
      } else if (warrantyEnd <= inThirtyDays) {
        expiring += 1;
      } else {
        active += 1;
      }
    }

    const total = Math.max(1, assets.length);
    return [
      {
        key: "active",
        label: "Aktif garanti",
        count: active,
        score: toScore((active / total) * 100),
        barClass: "bg-gradient-to-r from-emerald-400 to-teal-400",
      },
      {
        key: "expiring",
        label: "Yakında bitecek",
        count: expiring,
        score: toScore((expiring / total) * 100),
        barClass: "bg-gradient-to-r from-amber-400 to-orange-400",
      },
      {
        key: "expired",
        label: "Süresi dolan",
        count: expired,
        score: toScore((expired / total) * 100),
        barClass: "bg-gradient-to-r from-rose-400 to-red-400",
      },
      {
        key: "unknown",
        label: "Tarihi girilmemiş",
        count: unknown,
        score: toScore((unknown / total) * 100),
        barClass: "bg-gradient-to-r from-slate-400 to-slate-300",
      },
    ];
  }, [assets, now]);

  return (
    <AppShell
      badge="Skor Analizi"
      title="Maliyet ve Skor"
      subtitle="Skor, varlık fiyatı / toplam maliyet (bakım + harcama) oranına göre hesaplanır."
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
            Maliyet trendi, yıllık karşılaştırma ve oran bazlı skor analizi {planConfig.label} planında kapalı.
            Pro plan ile aktif olur.
          </p>
        </section>
      ) : (
        <>
          <section className="premium-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Dönem Filtresi</h2>
                <p className="mt-1 text-sm text-slate-300">Özet metrikler ve skor seçili döneme göre güncellenir.</p>
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
            <SummaryCard
              label={`${periodLabel} Oran Skoru (${periodAggregate.log_count} Kayıt)`}
              value={`${ratioBreakdown.score}/100`}
            />
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <article className="premium-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Skor Hesaplama Özeti</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Analiz, varlık fiyatı / toplam maliyet oranını 0-100 bandına normalize eder.
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${scoreToneClass}`}>
                  {ratioBreakdown.scoreLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {scoreRows.map((item) => (
                  <ScoreProgressRow key={item.key} label={item.label} score={item.score} barClass={item.barClass} />
                ))}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <SummaryInline label="Toplam Varlık Fiyatı" value={currencyFormatter.format(ratioBreakdown.totalAssetPrice)} />
                <SummaryInline label="Toplam Bakım Harcaması" value={currencyFormatter.format(ratioBreakdown.totalMaintenanceCost)} />
                <SummaryInline label="Toplam Harcama" value={currencyFormatter.format(ratioBreakdown.totalExpenseCost)} />
                <SummaryInline label="Toplam Maliyet" value={currencyFormatter.format(ratioBreakdown.totalCost)} />
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Eşikler: 1 ve altı 20, 1-2 arası 40, 2-4 arası 60, 4-8 arası 80, 8 üstü 95.
                {ratioBreakdown.hasNoCost ? " Toplam maliyet 0 olduğunda skor 100 kabul edilir." : ""}
              </p>
            </article>

            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">Garanti Durumu</h2>
              <p className="mt-1 text-sm text-slate-300">Tüm alt kırılımlar 0-100 bar olarak gösterilir.</p>

              <div className="mt-4 space-y-3">
                {warrantyItems.map((item) => (
                  <ScoreProgressRow key={item.key} label={item.label} score={item.score} barClass={item.barClass} />
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

          <section className="premium-card p-5">
            <h2 className="text-lg font-semibold text-white">Seçili Dönem Kategori Dağılımı</h2>
            {isLoading ? (
              <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
            ) : categorySeries.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">Seçili dönemde maliyet kaydı bulunmuyor.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {categorySeries.map((item) => {
                  const width = Math.max(8, (item.total / maxCategoryCost) * 100);
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>{item.label}</span>
                        <span>{currencyFormatter.format(item.total)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function ScoreProgressRow({ label, score, barClass }: { label: string; score: number; barClass: string }) {
  const width = score > 0 ? Math.max(4, score) : 0;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-300">{label}</div>
          <div className="relative z-10 h-2 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-white/10">
            <div className={`absolute inset-y-0 left-0 z-20 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
          </div>
        </div>
        <span className="text-xs font-semibold text-white">{score}/100</span>
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
