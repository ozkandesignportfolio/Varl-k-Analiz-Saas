"use client";

import { useMemo } from "react";
import { AssetPerformanceComparisonChart } from "@/components/kpi/asset-performance-comparison-chart";
import { YearlyCostLineChart } from "@/components/kpi/yearly-cost-line-chart";

type AssetInput = {
  id: string;
  name: string;
};

type ServiceLogInput = {
  asset_id: string;
  rule_id: string | null;
  service_type: string;
  service_date: string;
  cost: number;
};

type RuleInput = {
  asset_id: string;
  next_due_date: string;
  is_active: boolean;
};

type KpiTrendDashboardProps = {
  assets: AssetInput[];
  serviceLogs: ServiceLogInput[];
  rules: RuleInput[];
  isLoading: boolean;
};

type YearlyCostPoint = {
  label: string;
  total: number;
};

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "2-digit",
});

const preventiveKeywords = [
  "bakım",
  "periyodik",
  "kontrol",
  "maintenance",
  "inspection",
  "check",
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const percentText = (value: number) => `%${value.toFixed(1)}`;

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isPreventiveType = (serviceType: string) => {
  const normalized = serviceType.toLocaleLowerCase("tr-TR");
  return preventiveKeywords.some((keyword) => normalized.includes(keyword));
};

export function KpiTrendDashboard({
  assets,
  serviceLogs,
  rules,
  isLoading,
}: KpiTrendDashboardProps) {
  const now = useMemo(() => new Date(), []);

  const yearlyCostPoints = useMemo<YearlyCostPoint[]>(() => {
    const points: YearlyCostPoint[] = [];

    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      const total = serviceLogs
        .filter((log) => {
          const logDate = parseDate(log.service_date);
          if (!logDate) return false;
          return logDate.getMonth() === month && logDate.getFullYear() === year;
        })
        .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);

      points.push({
        label: monthFormatter.format(date),
        total,
      });
    }

    return points;
  }, [now, serviceLogs]);

  const assetPerformancePoints = useMemo(() => {
    const oneYearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const activeRuleCountByAsset = new Map<string, number>();

    for (const rule of rules) {
      if (!rule.is_active) continue;
      activeRuleCountByAsset.set(
        rule.asset_id,
        (activeRuleCountByAsset.get(rule.asset_id) ?? 0) + 1,
      );
    }

    const logsInYear = serviceLogs.filter((log) => {
      const logDate = parseDate(log.service_date);
      if (!logDate) return false;
      return logDate >= oneYearAgo;
    });

    const fleetAverageCost =
      logsInYear.length > 0
        ? logsInYear.reduce((sum, log) => sum + Number(log.cost ?? 0), 0) / logsInYear.length
        : 0;

    return assets
      .map((asset) => {
        const assetLogs = logsInYear.filter((log) => log.asset_id === asset.id);
        const activeRules = activeRuleCountByAsset.get(asset.id) ?? 0;
        const serviceCount = assetLogs.length;
        const linkedCount = assetLogs.filter((log) => Boolean(log.rule_id)).length;
        const totalCost = assetLogs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
        const averageCost = serviceCount > 0 ? totalCost / serviceCount : 0;

        if (activeRules === 0 && serviceCount === 0) {
          return null;
        }

        const coverageScore =
          activeRules > 0 ? clamp((serviceCount / activeRules) * 100, 0, 100) : serviceCount > 0 ? 75 : 0;
        const plannedScore = serviceCount > 0 ? (linkedCount / serviceCount) * 100 : 0;
        const costEfficiency =
          fleetAverageCost > 0 && serviceCount > 0
            ? clamp(100 - ((averageCost - fleetAverageCost) / fleetAverageCost) * 50, 0, 100)
            : 60;

        const score = clamp(coverageScore * 0.4 + plannedScore * 0.35 + costEfficiency * 0.25, 0, 100);

        return {
          assetName: asset.name,
          score,
          serviceCount,
        };
      })
      .filter((point): point is { assetName: string; score: number; serviceCount: number } =>
        Boolean(point),
      )
      .sort((a, b) => b.score - a.score || b.serviceCount - a.serviceCount)
      .slice(0, 8);
  }, [assets, now, rules, serviceLogs]);

  const maintenanceSnapshot = useMemo(() => {
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);
    const inSevenDays = new Date(now);
    inSevenDays.setDate(now.getDate() + 7);

    const activeRules = rules.filter((rule) => rule.is_active);
    const overdueCount = activeRules.filter((rule) => {
      const due = parseDate(rule.next_due_date);
      if (!due) return false;
      return due < now;
    }).length;
    const upcomingCount = activeRules.filter((rule) => {
      const due = parseDate(rule.next_due_date);
      if (!due) return false;
      return due >= now && due <= inSevenDays;
    }).length;

    const logsInNinetyDays = serviceLogs.filter((log) => {
      const logDate = parseDate(log.service_date);
      if (!logDate) return false;
      return logDate >= ninetyDaysAgo;
    });

    const linkedServices = logsInNinetyDays.filter((log) => Boolean(log.rule_id)).length;
    const preventiveServices = logsInNinetyDays.filter((log) =>
      isPreventiveType(log.service_type),
    ).length;
    const unplannedServices = logsInNinetyDays.filter((log) => !log.rule_id).length;
    const ninetyDaysTotalCost = logsInNinetyDays.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);

    const scheduleHealth =
      activeRules.length > 0 ? ((activeRules.length - overdueCount) / activeRules.length) * 100 : 100;
    const plannedServiceRate =
      logsInNinetyDays.length > 0 ? (linkedServices / logsInNinetyDays.length) * 100 : 0;
    const preventiveRate =
      logsInNinetyDays.length > 0 ? (preventiveServices / logsInNinetyDays.length) * 100 : 0;
    const averageCost =
      logsInNinetyDays.length > 0 ? ninetyDaysTotalCost / logsInNinetyDays.length : 0;

    return {
      activeRuleCount: activeRules.length,
      overdueCount,
      upcomingCount,
      unplannedServices,
      logsInNinetyDaysCount: logsInNinetyDays.length,
      scheduleHealth: clamp(scheduleHealth, 0, 100),
      plannedServiceRate: clamp(plannedServiceRate, 0, 100),
      preventiveRate: clamp(preventiveRate, 0, 100),
      averageCost,
    };
  }, [now, rules, serviceLogs]);

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


