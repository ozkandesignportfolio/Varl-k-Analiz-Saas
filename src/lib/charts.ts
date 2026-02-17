export type ServiceCostLog = {
  asset_id: string;
  service_date: string;
  cost: number;
};

export type AssetCategory = {
  id: string;
  category: string;
};

export type PeriodFilter = "3m" | "6m" | "12m" | "this_year" | "all";

export type CostPoint = {
  label: string;
  total: number;
};

const monthLabelFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  year: "2-digit",
});

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const earliestLogMonth = (logs: ServiceCostLog[]) => {
  let earliest: Date | null = null;

  for (const log of logs) {
    const date = parseDate(log.service_date);
    if (!date) continue;
    if (!earliest || date.getTime() < earliest.getTime()) {
      earliest = date;
    }
  }

  return earliest ? monthStart(earliest) : null;
};

export const sumCost = (logs: ServiceCostLog[]) =>
  logs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);

export const getCurrentYearCost = (logs: ServiceCostLog[], now = new Date()) => {
  const currentYear = now.getFullYear();
  return logs
    .filter((log) => {
      const date = parseDate(log.service_date);
      return Boolean(date) && date!.getFullYear() === currentYear;
    })
    .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
};

export const getTrailingTwelveMonthCost = (logs: ServiceCostLog[], now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return logs
    .filter((log) => {
      const date = parseDate(log.service_date);
      if (!date) return false;
      return date >= start && date < end;
    })
    .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
};

const periodStart = (period: PeriodFilter, logs: ServiceCostLog[], now = new Date()) => {
  if (period === "3m") return new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (period === "6m") return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  if (period === "12m") return new Date(now.getFullYear(), now.getMonth() - 11, 1);
  if (period === "this_year") return new Date(now.getFullYear(), 0, 1);
  return earliestLogMonth(logs) ?? new Date(now.getFullYear(), now.getMonth(), 1);
};

export const filterLogsByPeriod = (logs: ServiceCostLog[], period: PeriodFilter, now = new Date()) => {
  const start = periodStart(period, logs, now);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return logs.filter((log) => {
    const date = parseDate(log.service_date);
    if (!date) return false;
    return date >= start && date < end;
  });
};

export const buildMonthlyCostSeries = (logs: ServiceCostLog[], period: PeriodFilter, now = new Date()) => {
  if (logs.length === 0) return [] as CostPoint[];

  const start = periodStart(period, logs, now);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const totals = new Map<string, number>();

  for (const log of logs) {
    const date = parseDate(log.service_date);
    if (!date) continue;
    const logMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    if (logMonth < start || logMonth > end) continue;
    const key = monthKey(logMonth);
    totals.set(key, (totals.get(key) ?? 0) + Number(log.cost ?? 0));
  }

  const points: CostPoint[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const key = monthKey(cursor);
    points.push({
      label: monthLabelFormatter.format(cursor),
      total: totals.get(key) ?? 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
};

export const buildYearlyCostSeries = (logs: ServiceCostLog[]) => {
  const map = new Map<number, number>();

  for (const log of logs) {
    const date = parseDate(log.service_date);
    if (!date) continue;
    map.set(date.getFullYear(), (map.get(date.getFullYear()) ?? 0) + Number(log.cost ?? 0));
  }

  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, total]) => ({
      label: String(year),
      total,
    }));
};

export const buildCategoryCostSeries = (logs: ServiceCostLog[], assets: AssetCategory[]) => {
  const categoryByAsset = new Map(assets.map((asset) => [asset.id, asset.category]));
  const totals = new Map<string, number>();

  for (const log of logs) {
    const category = categoryByAsset.get(log.asset_id) ?? "Belirsiz";
    totals.set(category, (totals.get(category) ?? 0) + Number(log.cost ?? 0));
  }

  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
};
