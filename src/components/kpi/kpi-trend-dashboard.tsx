"use client";

import { AssetPerformanceComparisonChart } from "@/components/kpi/asset-performance-comparison-chart";
import {
  type KpiAssetInput,
  type KpiRuleInput,
  type KpiServiceLogInput,
  useKpiTrendData,
} from "@/components/kpi/hooks/use-kpi-trend-data";
import { YearlyCostLineChart } from "@/components/kpi/yearly-cost-line-chart";

type KpiTrendDashboardProps = {
  assets: KpiAssetInput[];
  serviceLogs: KpiServiceLogInput[];
  rules: KpiRuleInput[];
  isLoading: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const percentText = (value: number) => `%${value.toFixed(1)}`;

export function KpiTrendDashboard({
  assets,
  serviceLogs,
  rules,
  isLoading,
}: KpiTrendDashboardProps) {
  const {
    yearlyCostPoints,
    assetPerformancePoints,
    maintenanceSnapshot,
  } = useKpiTrendData({ assets, serviceLogs, rules });

  return (
    <section className="grid gap-3 xl:grid-cols-3">
      <article className="premium-card p-5 xl:col-span-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white">12 Aylık Maliyet Trendi</h2>
            <p className="mt-1 text-sm text-slate-300">
              Servis loglarından oluşan son 12 ayın maliyet çizgisi.
            </p>
          </div>
        </div>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : serviceLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Grafik için servis verisi bulunmuyor.</p>
        ) : (
          <div className="mt-4 h-72">
            <YearlyCostLineChart points={yearlyCostPoints} />
          </div>
        )}
      </article>

      <article className="premium-card p-5 xl:col-span-2">
        <h2 className="text-lg font-semibold text-white">Varlık Performans Karşılaştırma</h2>
        <p className="mt-1 text-sm text-slate-300">
          Skor: servis kapsama + planlı servis oranı + maliyet verimliliği.
        </p>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : assetPerformancePoints.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Karşılaştırma için yeterli veri yok.</p>
        ) : (
          <div className="mt-4 h-80">
            <AssetPerformanceComparisonChart points={assetPerformancePoints} />
          </div>
        )}
      </article>

      <article className="premium-card p-5">
        <h2 className="text-lg font-semibold text-white">Bakım Öncelik Panosu</h2>
        <p className="mt-1 text-sm text-slate-300">
          Son 90 gün verisine göre plan uyumu ve operasyonel aksiyon özeti.
        </p>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : (
          <div className="mt-4 space-y-4">
            <MetricBar
              label="Zamanında Kural Sağlığı"
              hint={`${maintenanceSnapshot.activeRuleCount} aktif kural içinde ${maintenanceSnapshot.overdueCount} gecikmiş`}
              value={maintenanceSnapshot.scheduleHealth}
            />
            <MetricBar
              label="Planlı Servis Oranı"
              hint={`Son 90 günde ${maintenanceSnapshot.logsInNinetyDaysCount} servisin ${maintenanceSnapshot.logsInNinetyDaysCount - maintenanceSnapshot.unplannedServices} adedi kurala bağlı`}
              value={maintenanceSnapshot.plannedServiceRate}
            />
            <MetricBar
              label="Önleyici Servis Payı"
              hint="Bakım/periyodik/kontrol tipli servislerin oranı"
              value={maintenanceSnapshot.preventiveRate}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <PriorityChip
                label="Bu hafta yaklaşan bakım"
                value={`${maintenanceSnapshot.upcomingCount}`}
                tone="info"
              />
              <PriorityChip
                label="Kural dışı servis kaydı"
                value={`${maintenanceSnapshot.unplannedServices}`}
                tone={maintenanceSnapshot.unplannedServices > 0 ? "warn" : "ok"}
              />
              <PriorityChip
                label="Gecikmiş aktif kural"
                value={`${maintenanceSnapshot.overdueCount}`}
                tone={maintenanceSnapshot.overdueCount > 0 ? "warn" : "ok"}
              />
              <PriorityChip
                label="90 gün ortalama servis maliyeti"
                value={`${maintenanceSnapshot.averageCost.toFixed(0)} TL`}
                tone="neutral"
              />
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

function MetricBar({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: number;
}) {
  const normalized = clamp(value, 0, 100);

  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-sm font-semibold text-white">{percentText(normalized)}</p>
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="line-shimmer h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function PriorityChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "info" | "neutral";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-300/35 bg-amber-300/10"
      : tone === "ok"
        ? "border-emerald-300/35 bg-emerald-300/10"
        : tone === "info"
          ? "border-sky-300/35 bg-sky-300/10"
          : "border-white/15 bg-white/[0.04]";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

