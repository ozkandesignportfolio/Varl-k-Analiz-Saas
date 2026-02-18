"use client";

import { useMemo } from "react";

export type KpiAssetInput = {
  id: string;
  name: string;
};

export type KpiServiceLogInput = {
  asset_id: string;
  rule_id: string | null;
  service_type: string;
  service_date: string;
  cost: number;
};

export type KpiRuleInput = {
  asset_id: string;
  next_due_date: string;
  is_active: boolean;
};

export type YearlyCostPoint = {
  label: string;
  total: number;
};

export type AssetPerformancePoint = {
  assetName: string;
  score: number;
  serviceCount: number;
};

export type MaintenanceSnapshot = {
  activeRuleCount: number;
  overdueCount: number;
  upcomingCount: number;
  unplannedServices: number;
  logsInNinetyDaysCount: number;
  scheduleHealth: number;
  plannedServiceRate: number;
  preventiveRate: number;
  averageCost: number;
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

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isPreventiveType = (serviceType: string) => {
  const normalized = serviceType.toLocaleLowerCase("tr-TR");
  return preventiveKeywords.some((keyword) => normalized.includes(keyword));
};

export function useKpiTrendData(params: {
  assets: KpiAssetInput[];
  serviceLogs: KpiServiceLogInput[];
  rules: KpiRuleInput[];
}) {
  const { assets, rules, serviceLogs } = params;
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

  const assetPerformancePoints = useMemo<AssetPerformancePoint[]>(() => {
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
      .filter((point): point is AssetPerformancePoint => Boolean(point))
      .sort((a, b) => b.score - a.score || b.serviceCount - a.serviceCount)
      .slice(0, 8);
  }, [assets, now, rules, serviceLogs]);

  const maintenanceSnapshot = useMemo<MaintenanceSnapshot>(() => {
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

  return {
    yearlyCostPoints,
    assetPerformancePoints,
    maintenanceSnapshot,
  };
}
