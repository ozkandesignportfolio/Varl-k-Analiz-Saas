import type { ReportsAssetSummaryRow } from "@/features/reports/components/reports-data-table";
import type { ListDocumentsForReportsWithAssetRow, ReportsDocumentsCursor } from "@/lib/repos/documents-repo";
import type { ListServiceLogsForReportsRow, ReportsServiceLogsCursor } from "@/lib/repos/service-logs-repo";

export const REPORTS_PAGE_SIZE = 100;

export type ServiceRow = ListServiceLogsForReportsRow;
export type DocumentRow = ListDocumentsForReportsWithAssetRow;

export type ReportsCursor = {
  services: ReportsServiceLogsCursor | null;
  documents: ReportsDocumentsCursor | null;
};

export type ReportsPageResponse = {
  services: ServiceRow[];
  documents: DocumentRow[];
  nextCursor: ReportsCursor;
  hasMore: boolean;
  hasMoreServices: boolean;
  hasMoreDocuments: boolean;
};

export const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const getTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const asSafeText = (value: unknown, fallback = "-") => {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text.length > 0 ? text : fallback;
};

export const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toStartOfDay = (value: string) => new Date(`${value}T00:00:00`);
export const toEndOfDay = (value: string) => new Date(`${value}T23:59:59.999`);

export const toTrDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const time = getTime(value);
  return time === null ? "-" : new Date(time).toLocaleDateString("tr-TR");
};

export const buildAssetNameById = (services: ServiceRow[], documents: DocumentRow[]) => {
  const map = new Map<string, string>();

  const register = (assetId: string, assetName: string | null) => {
    const safeAssetId = asSafeText(assetId, "");
    const safeAssetName = asSafeText(assetName, "");
    if (!safeAssetId || !safeAssetName || map.has(safeAssetId)) return;
    map.set(safeAssetId, safeAssetName);
  };

  for (const service of services) {
    register(service.asset_id, service.asset_name);
  }

  for (const document of documents) {
    register(document.asset_id, document.asset_name);
  }

  return map;
};

export const calculateTotalCost = (services: Pick<ServiceRow, "cost">[]) =>
  services.reduce((sum, service) => {
    const cost = Number(service.cost);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);

export const calculateAverageCost = (serviceCount: number, totalCost: number) =>
  serviceCount > 0 ? totalCost / serviceCount : 0;

export const calculateActiveAssetCount = (
  services: Pick<ServiceRow, "asset_id">[],
  documents: Pick<DocumentRow, "asset_id">[],
) => {
  const ids = new Set<string>();

  for (const service of services) {
    const assetId = asSafeText(service.asset_id, "");
    if (assetId) ids.add(assetId);
  }

  for (const document of documents) {
    const assetId = asSafeText(document.asset_id, "");
    if (assetId) ids.add(assetId);
  }

  return ids.size;
};

export const buildAssetSummary = (
  services: ServiceRow[],
  documents: DocumentRow[],
  assetNameById: Map<string, string>,
): ReportsAssetSummaryRow[] => {
  const serviceMap = new Map<string, { serviceCount: number; totalCost: number }>();
  const documentMap = new Map<string, number>();

  for (const service of services) {
    const assetId = asSafeText(service.asset_id, "__missing_asset__");
    const previous = serviceMap.get(assetId) ?? { serviceCount: 0, totalCost: 0 };
    const cost = Number(service.cost);
    serviceMap.set(assetId, {
      serviceCount: previous.serviceCount + 1,
      totalCost: previous.totalCost + (Number.isFinite(cost) ? cost : 0),
    });
  }

  for (const document of documents) {
    const assetId = asSafeText(document.asset_id, "__missing_asset__");
    documentMap.set(assetId, (documentMap.get(assetId) ?? 0) + 1);
  }

  const assetIds = new Set<string>([
    ...services.map((item) => asSafeText(item.asset_id, "__missing_asset__")),
    ...documents.map((item) => asSafeText(item.asset_id, "__missing_asset__")),
  ]);

  return [...assetIds]
    .map((assetId) => {
      const serviceInfo = serviceMap.get(assetId) ?? { serviceCount: 0, totalCost: 0 };
      const documentCount = documentMap.get(assetId) ?? 0;

      return {
        assetName: assetNameById.get(assetId) ?? "Bilinmeyen Varlık",
        serviceCount: serviceInfo.serviceCount,
        documentCount,
        totalCost: serviceInfo.totalCost,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || b.serviceCount - a.serviceCount);
};
