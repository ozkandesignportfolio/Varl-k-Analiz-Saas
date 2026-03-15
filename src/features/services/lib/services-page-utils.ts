import type { ServiceLogTableRow } from "@/features/services/components/service-log-table";

export const serviceTypes = ["Periyodik Bakım", "Arıza Onarım", "Temizlik", "Parça Değişimi", "Diğer"];

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
