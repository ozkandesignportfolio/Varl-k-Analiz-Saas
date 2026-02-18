"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CostTrendLineChart } from "@/components/costs/cost-trend-line-chart";
import { YearlyCostBarChart } from "@/components/costs/yearly-cost-bar-chart";
import {
  type AssetCategory,
  buildCategoryCostSeries,
  buildMonthlyCostSeries,
  buildYearlyCostSeries,
  filterLogsByPeriod,
  type PeriodFilter,
  type ServiceCostLog,
} from "@/lib/charts";
import { getPlanConfig, getUserPlanConfig, type PlanConfig } from "@/lib/plans/plan-config";
import { getCostAggregate, listForCosts, type ServiceLogCostAggregate } from "@/lib/repos/service-logs-repo";
import { createClient } from "@/lib/supabase/client";

type ServiceRow = ServiceCostLog & {
  id: string;
};

type AssetRow = AssetCategory;
type DateRange = {
  sinceDate?: string;
  beforeDate?: string;
};

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "3m", label: "Son 3 Ay" },
  { value: "6m", label: "Son 6 Ay" },
  { value: "12m", label: "Son 12 Ay" },
  { value: "this_year", label: "Bu Yil" },
  { value: "all", label: "Tum Donem" },
];

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const selectClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const emptyCostAggregate: ServiceLogCostAggregate = {
  total_cost: 0,
  log_count: 0,
  avg_cost: 0,
  cost_score: 0,
};

const DEFAULT_PLAN_CONFIG: PlanConfig = getPlanConfig("starter");

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

export default function CostsPage() {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);

  const [activeUserId, setActiveUserId] = useState("");
  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("12m");
  const [periodAggregate, setPeriodAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [currentYearAggregate, setCurrentYearAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [trailingTwelveAggregate, setTrailingTwelveAggregate] = useState<ServiceLogCostAggregate>(emptyCostAggregate);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [planConfig, setPlanConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFeedback(userError?.message ?? "Oturum bulunamadi. Lutfen tekrar giris yapin.");
        setIsLoading(false);
        return;
      }

      const userPlan = getUserPlanConfig(user);
      setPlanConfig(userPlan);

      if (!userPlan.features.canUseAdvancedAnalytics) {
        setLogs([]);
        setAssets([]);
        setPeriodAggregate(emptyCostAggregate);
        setCurrentYearAggregate(emptyCostAggregate);
        setTrailingTwelveAggregate(emptyCostAggregate);
        setIsLoading(false);
        return;
      }

      setActiveUserId(user.id);

      const [logsRes, assetsRes, currentYearRes, trailingTwelveRes] = await Promise.all([
        listForCosts(supabase, { userId: user.id }),
        supabase.from("assets").select("id,category").eq("user_id", user.id),
        getCostAggregate(supabase, { userId: user.id, ...getCurrentYearRange(now) }),
        getCostAggregate(supabase, { userId: user.id, ...getTrailingTwelveMonthRange(now) }),
      ]);

      if (logsRes.error) setFeedback(logsRes.error.message);
      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (currentYearRes.error) setFeedback(currentYearRes.error.message);
      if (trailingTwelveRes.error) setFeedback(trailingTwelveRes.error.message);

      setLogs((logsRes.data ?? []) as ServiceRow[]);
      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setCurrentYearAggregate((currentYearRes.data ?? emptyCostAggregate) as ServiceLogCostAggregate);
      setTrailingTwelveAggregate((trailingTwelveRes.data ?? emptyCostAggregate) as ServiceLogCostAggregate);
      setIsLoading(false);
    };

    void load();
  }, [now, supabase]);

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
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? "Secili donem";
  const maxCategoryCost = useMemo(() => Math.max(1, ...categorySeries.map((item) => item.total)), [categorySeries]);

  return (
    <AppShell badge="Maliyet Analizi" title="Maliyetler" subtitle="Servis kayitlarindan donem, aylik trend ve yillik toplam analizi yapilir.">
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {!planConfig.features.canUseAdvancedAnalytics ? (
        <section className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Gelismis Analitik Kilidi</h2>
          <p className="mt-2 text-sm text-slate-300">
            Maliyet trendi, yillik karsilastirma ve kategori dagilimi gibi gelismis analitik panolari{" "}
            {planConfig.label} planinda kapali. Pro plan ile aktif olur.
          </p>
        </section>
      ) : (
        <>
          <section className="premium-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Donem Filtresi</h2>
                <p className="mt-1 text-sm text-slate-300">Ozet metrikler ve trend grafigi secili doneme gore guncellenir.</p>
              </div>
              <label className="block w-full sm:w-64">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-slate-400">Donem</span>
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
            <SummaryCard label={`${periodLabel} Toplami`} value={currencyFormatter.format(periodAggregate.total_cost)} />
            <SummaryCard label="Bu Yil Toplami" value={currencyFormatter.format(currentYearAggregate.total_cost)} />
            <SummaryCard label="Son 12 Ay Toplami" value={currencyFormatter.format(trailingTwelveAggregate.total_cost)} />
            <SummaryCard
              label={`${periodLabel} Maliyet Skoru (${periodAggregate.log_count} Kayit)`}
              value={`${periodAggregate.cost_score}/100`}
            />
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">{periodLabel} Maliyet Trendi</h2>
              <p className="mt-1 text-sm text-slate-300">Aylik servis maliyeti dagilimi.</p>
              {isLoading ? (
                <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
              ) : logs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-300">Grafik icin servis verisi bulunmuyor.</p>
              ) : (
                <div className="mt-4 h-72">
                  <CostTrendLineChart points={monthlySeries} />
                </div>
              )}
            </article>

            <article className="premium-card p-5">
              <h2 className="text-lg font-semibold text-white">Yillik Toplam Karsilastirmasi</h2>
              <p className="mt-1 text-sm text-slate-300">Yillara gore toplam servis maliyeti.</p>
              {isLoading ? (
                <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
              ) : yearlySeries.length === 0 ? (
                <p className="mt-4 text-sm text-slate-300">Yillik maliyet verisi bulunmuyor.</p>
              ) : (
                <div className="mt-4 h-72">
                  <YearlyCostBarChart points={yearlySeries} />
                </div>
              )}
            </article>
          </section>

          <section className="premium-card p-5">
            <h2 className="text-lg font-semibold text-white">Secili Donem Kategori Dagilimi</h2>
            {isLoading ? (
              <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
            ) : categorySeries.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">Secili donemde maliyet kaydi bulunmuyor.</p>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

