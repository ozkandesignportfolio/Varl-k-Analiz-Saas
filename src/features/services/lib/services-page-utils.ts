import type { ServiceLogTableRow } from "@/features/services/components/service-log-table";
import type { AssetOptionRow, ServiceLogsPageResponse } from "@/features/services/lib/services-page-types";

export const serviceTypes = ["Periyodik Bakım", "Arıza Onarımı", "Temizlik", "Parça Değişimi", "Diğer"];

export const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export const SERVICES_PAGE_SIZE = 50;

export const isDateRangeInvalid = (startDate: string, endDate: string) =>
  Boolean(startDate && endDate && startDate > endDate);

export const calculateTotalCost = (rows: ServiceLogTableRow[]) =>
  rows.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);

export const buildServiceTypeDistribution = (rows: ServiceLogTableRow[]) => {
  const map = new Map<string, number>();
  for (const log of rows) {
    map.set(log.service_type, (map.get(log.service_type) ?? 0) + 1);
  }
  return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
};

export const buildAssetOptionLabel = (asset: AssetOptionRow) =>
  [asset.name, asset.category, asset.serial_number ? `SN: ${asset.serial_number}` : null]
    .filter((value) => Boolean(value && value.trim().length > 0))
    .join(" • ");

export const toServiceLogsPageResponse = (payload: unknown): ServiceLogsPageResponse => {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;

  return {
    rows: data && "rows" in data && Array.isArray(data.rows) ? (data.rows as ServiceLogTableRow[]) : [],
    nextCursor:
      data && "nextCursor" in data && data.nextCursor
        ? (data.nextCursor as ServiceLogsPageResponse["nextCursor"])
        : null,
    hasMore: Boolean(data && "hasMore" in data && data.hasMore),
  };
};

export const buildLogsSummary = (rows: ServiceLogTableRow[]) => {
  const visibleAssetIds = new Set<string>();

  for (const log of rows) {
    visibleAssetIds.add(log.asset_id);
  }

  const totalCost = calculateTotalCost(rows);
  const serviceTypeDistribution = buildServiceTypeDistribution(rows);

  return {
    totalCost,
    visibleAssetCount: visibleAssetIds.size,
    serviceTypeDistribution,
  };
};
