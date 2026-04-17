"use client";

import dynamic from "next/dynamic";
import {
  type KpiAssetInput,
  type KpiRuleInput,
  type KpiServiceLogInput,
  useKpiTrendData,
} from "@/components/kpi/hooks/use-kpi-trend-data";

// Lazy-load heavy Chart.js charts so they don't ship in the main bundle.
// The dashboard renders the surrounding layout immediately; charts mount when
// data is ready. ssr:false because react-chartjs-2 uses canvas (client-only).
const YearlyCostLineChart = dynamic(
  () => import("@/components/kpi/yearly-cost-line-chart").then((mod) => mod.YearlyCostLineChart),
  { ssr: false },
);

const AssetPerformanceComparisonChart = dynamic(
  () =>
    import("@/components/kpi/asset-performance-comparison-chart").then(
      (mod) => mod.AssetPerformanceComparisonChart,
    ),
  { ssr: false },
);

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
            <h2 className="auth-card-title text-lg font-semibold">12 Aylık Maliyet Trendi</h2>
            <p className="auth-card-subtitle mt-1 text-sm">
              Servis loglarından oluşan son 12 ayın maliyet çizgisi.
            </p>
          </div>
        </div>
        {isLoading ? (
          <p className="auth-card-subtitle mt-4 text-sm">Yükleniyor...</p>
        ) : serviceLogs.length === 0 ? (
          <p className="auth-card-subtitle mt-4 text-sm">Grafik için servis verisi bulunmuyor.</p>
        ) : (
          <div className="mt-4 h-72">
            <YearlyCostLineChart points={yearlyCostPoints} />
          </div>
        )}
      </article>

      <article className="premium-card p-5 xl:col-span-2">
        <h2 className="auth-card-title text-lg font-semibold">Varlık Performans Karşılaştırma</h2>
        <p className="auth-card-subtitle mt-1 text-sm">
          Skor: servis kapsama + planlı servis oranı + maliyet verimliliği.
        </p>
        {isLoading ? (
          <p className="auth-card-subtitle mt-4 text-sm">Yükleniyor...</p>
        ) : assetPerformancePoints.length === 0 ? (
          <p className="auth-card-subtitle mt-4 text-sm">Karşılaştırma için yeterli veri yok.</p>
        ) : (
          <div className="mt-4 h-80">
            <AssetPerformanceComparisonChart points={assetPerformancePoints} />
          </div>
        )}
      </article>

      <article className="premium-card p-5">
        <h2 className="auth-card-title text-lg font-semibold">Bakım Öncelik Panosu</h2>
        <p className="auth-card-subtitle mt-1 text-sm">
          Son 90 gün verisine göre plan uyumu ve operasyonel aksiyon özeti.
        </p>
        {isLoading ? (
          <p className="auth-card-subtitle mt-4 text-sm">Yükleniyor...</p>
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
    <div className="auth-subtle-block rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="auth-row-value text-sm font-medium">{label}</p>
        <p className="auth-row-value text-sm font-semibold">{percentText(normalized)}</p>
      </div>
      <p className="auth-meta-text mt-1 text-xs">{hint}</p>
      <div className="auth-progress-track mt-3 h-2 overflow-hidden rounded-full">
        <div
          className="auth-progress-fill line-shimmer h-full rounded-full"
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
      ? "auth-tone-chip-warn"
      : tone === "ok"
        ? "auth-tone-chip-ok"
      : tone === "info"
          ? "auth-tone-chip-info"
          : "auth-tone-chip-neutral";

  return (
    <div className={`auth-tone-chip rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="auth-row-label text-xs">{label}</p>
      <p className="auth-row-value mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

