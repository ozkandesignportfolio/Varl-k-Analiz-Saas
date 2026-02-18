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
  getCurrentYearCost,
  getTrailingTwelveMonthCost,
  type PeriodFilter,
  type ServiceCostLog,
  sumCost,
} from "@/lib/charts";
import { listForCosts } from "@/lib/repos/service-logs-repo";
import { createClient } from "@/lib/supabase/client";

type ServiceRow = ServiceCostLog & {
  id: string;
};

type AssetRow = AssetCategory;

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

const selectClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export default function CostsPage() {
  const supabase = useMemo(() => createClient(), []);
  const now = useMemo(() => new Date(), []);

  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("12m");
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

      const [logsRes, assetsRes] = await Promise.all([
        listForCosts(supabase, { userId: user.id }),
        supabase.from("assets").select("id,category").eq("user_id", user.id),
      ]);

      if (logsRes.error) setFeedback(logsRes.error.message);
      if (assetsRes.error) setFeedback(assetsRes.error.message);

      setLogs((logsRes.data ?? []) as ServiceRow[]);
      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setIsLoading(false);
    };

    void load();
  }, [supabase]);

  const filteredLogs = useMemo(() => filterLogsByPeriod(logs, period, now), [logs, period, now]);

  const periodTotal = useMemo(() => sumCost(filteredLogs), [filteredLogs]);

  const currentYearTotal = useMemo(() => getCurrentYearCost(logs, now), [logs, now]);

  const trailingTwelveMonthTotal = useMemo(
    () => getTrailingTwelveMonthCost(logs, now),
    [logs, now],
  );

  const monthlySeries = useMemo(() => buildMonthlyCostSeries(logs, period, now), [logs, period, now]);

  const yearlySeries = useMemo(() => buildYearlyCostSeries(logs), [logs]);

  const categorySeries = useMemo(() => buildCategoryCostSeries(filteredLogs, assets), [filteredLogs, assets]);

  const periodLabel =
    periodOptions.find((option) => option.value === period)?.label ?? "Seçili dönem";

  const maxCategoryCost = useMemo(
    () => Math.max(1, ...categorySeries.map((item) => item.total)),
    [categorySeries],
  );

  return (
    <AppShell
      badge="Maliyet Analizi"
      title="Maliyetler"
      subtitle="Servis kayıtlarından dönem, aylık trend ve yıllık toplam analizi yapılır."
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      <section className="premium-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Dönem Filtresi</h2>
            <p className="mt-1 text-sm text-slate-300">Özet metrikler ve trend grafiği seçili döneme göre güncellenir.</p>
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
        <SummaryCard label={`${periodLabel} Toplamı`} value={currencyFormatter.format(periodTotal)} />
        <SummaryCard label="Bu Yıl Toplamı" value={currencyFormatter.format(currentYearTotal)} />
        <SummaryCard
          label="Son 12 Ay Toplamı"
          value={currencyFormatter.format(trailingTwelveMonthTotal)}
        />
        <SummaryCard label="Servis Kaydı" value={String(filteredLogs.length)} />
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
