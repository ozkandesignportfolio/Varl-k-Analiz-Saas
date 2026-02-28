import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient } from "@/lib/repos/_shared";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DashboardSnapshotRpcTrend = {
  direction?: unknown;
  percentage?: unknown;
  sparkline?: unknown;
};

type DashboardSnapshotRpcStatus = {
  tone?: unknown;
  headline?: unknown;
  detail?: unknown;
  risk_count?: unknown;
  risk?: unknown;
};

type DashboardSnapshotRpcPayload = {
  counts?: unknown;
  sums?: unknown;
  metrics?: unknown;
  trends?: unknown;
  status?: unknown;
  risk_panel?: unknown;
  timeline?: unknown;
};

export type DashboardDateRangeDays = 7 | 30 | 90;

export const DASHBOARD_RANGE_OPTIONS: DashboardDateRangeDays[] = [7, 30, 90];

export const parseDashboardDateRange = (value: string | undefined): DashboardDateRangeDays => {
  const normalized = Number(value);
  if (normalized === 7 || normalized === 30 || normalized === 90) {
    return normalized;
  }
  return 30;
};

export type DashboardMaintenanceRiskItem = {
  id: string;
  assetId: string;
  assetName: string;
  ruleTitle: string;
  dueDate: string;
  dayCount: number;
};

export type DashboardWarrantyRiskItem = {
  id: string;
  assetId: string;
  assetName: string;
  warrantyEndDate: string;
  daysRemaining: number;
};

export type DashboardPaymentRiskItem = {
  id: string;
  invoiceNo: string | null;
  subscriptionName: string;
  dueDate: string;
  totalAmount: number;
  status: "pending" | "overdue";
  daysRemaining: number;
};

export type DashboardMissingDocumentRiskItem = {
  id: string;
  assetId: string;
  assetName: string;
  createdAt: string;
  daysWithoutDocument: number;
};

export type DashboardActivityType = "service" | "document" | "rule" | "payment";

export type DashboardActivityItem = {
  id: string;
  type: DashboardActivityType;
  title: string;
  description: string;
  date: string;
  href: string;
};

export type DashboardTrendDirection = "up" | "down" | "flat";

export type DashboardKpiTrend = {
  direction: DashboardTrendDirection;
  percentage: number;
  sparkline: number[];
};

export type DashboardSystemTone = "stable" | "healthy" | "warning" | "critical";

export type DashboardSystemRiskType =
  | "maintenance_due"
  | "rule_missing"
  | "document_missing"
  | "invoice_due"
  | "notification_prefs";

export type DashboardSystemRisk = {
  type: DashboardSystemRiskType;
  entityId: string | null;
  riskKey: string;
};

export type DashboardSystemStatus = {
  tone: DashboardSystemTone;
  headline: string;
  detail: string;
  riskCount: number;
  risk: DashboardSystemRisk;
};

export type DashboardSnapshot = {
  metrics: {
    totalAssets: number;
    activeRules: number;
    totalServiceCost: number;
    documentCount: number;
    subscriptionCount: number;
    invoiceCount: number;
    documentsTotalSize: number;
    invoicesTotalAmount: number;
  };
  trends: {
    totalAssets: DashboardKpiTrend;
    activeRules: DashboardKpiTrend;
    totalServiceCost: DashboardKpiTrend;
    documentCount: DashboardKpiTrend;
  };
  status: DashboardSystemStatus;
  riskPanel: {
    overdueMaintenance: DashboardMaintenanceRiskItem[];
    upcomingMaintenance: DashboardMaintenanceRiskItem[];
    upcomingWarranty: DashboardWarrantyRiskItem[];
    upcomingPayments: DashboardPaymentRiskItem[];
    missingDocuments: DashboardMissingDocumentRiskItem[];
  };
  recentActivity: DashboardActivityItem[];
};

export type DashboardSnapshotResult = {
  data: DashboardSnapshot;
  isMock: boolean;
  warning: string | null;
};

const ALLOWED_ACTIVITY_TYPES = new Set<DashboardActivityType>(["service", "document", "rule", "payment"]);
const ALLOWED_TREND_DIRECTIONS = new Set<DashboardTrendDirection>(["up", "down", "flat"]);
const ALLOWED_STATUS_TONES = new Set<DashboardSystemTone>(["stable", "healthy", "warning", "critical"]);
const ALLOWED_RISK_TYPES = new Set<DashboardSystemRiskType>([
  "maintenance_due",
  "rule_missing",
  "document_missing",
  "invoice_due",
  "notification_prefs",
]);
const DASHBOARD_SNAPSHOT_MISSING_FN_PATTERN = /Could not find the function public\.get_dashboard_snapshot/i;

const toRiskKey = (type: DashboardSystemRiskType, entityId?: string | null) => `${type}:${entityId ?? "global"}`;

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInteger = (value: number | string | null | undefined) => {
  const rounded = Math.round(toNumber(value));
  return rounded > 0 ? rounded : 0;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_IN_MS);

const createSparkline = (direction: DashboardTrendDirection) => {
  if (direction === "up") return [22, 24, 28, 30, 34, 37];
  if (direction === "down") return [37, 34, 31, 28, 25, 22];
  return [28, 27, 28, 27, 28, 27];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown) => (isRecord(value) ? value : null);
const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const toStringOr = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const toDashboardSnapshotWarning = (error: PostgrestError) => {
  if (DASHBOARD_SNAPSHOT_MISSING_FN_PATTERN.test(error.message)) {
    return "Dashboard snapshot RPC fonksiyonu bulunamadi. Supabase migration dosyalarini sirayla calistirin: 20260228150000_dashboard_snapshot_rpc.sql, 20260228155000_dashboard_snapshot_rpc_remove_ambiguous_overload.sql.";
  }
  return `Dashboard snapshot RPC hatasi: ${error.message}`;
};

const parseTrend = (value: unknown): DashboardKpiTrend => {
  const record = asRecord(value) as DashboardSnapshotRpcTrend | null;
  const directionCandidate = toStringOr(record?.direction, "flat");
  const direction = ALLOWED_TREND_DIRECTIONS.has(directionCandidate as DashboardTrendDirection)
    ? (directionCandidate as DashboardTrendDirection)
    : "flat";

  const sparkline = asArray(record?.sparkline)
    .slice(0, 6)
    .map((item) => toNumber(item as number | string | null | undefined));

  return {
    direction,
    percentage: toInteger(record?.percentage as number | string | null | undefined),
    sparkline: sparkline.length === 6 ? sparkline : createSparkline(direction),
  };
};

const parseStatus = (value: unknown): DashboardSystemStatus => {
  const record = asRecord(value) as DashboardSnapshotRpcStatus | null;
  const riskRecord = asRecord(record?.risk);

  const toneCandidate = toStringOr(record?.tone, "stable");
  const tone = ALLOWED_STATUS_TONES.has(toneCandidate as DashboardSystemTone)
    ? (toneCandidate as DashboardSystemTone)
    : "stable";

  const riskTypeCandidate = toStringOr(riskRecord?.type, "notification_prefs");
  const riskType = ALLOWED_RISK_TYPES.has(riskTypeCandidate as DashboardSystemRiskType)
    ? (riskTypeCandidate as DashboardSystemRiskType)
    : "notification_prefs";

  const entityId = riskRecord?.entity_id;
  const safeEntityId = typeof entityId === "string" && entityId.length > 0 ? entityId : null;

  return {
    tone,
    headline: toStringOr(record?.headline, "Stabil"),
    detail: toStringOr(record?.detail, "Sistem durumu veri geldikce otomatik guncellenecek."),
    riskCount: toInteger(record?.risk_count as number | string | null | undefined),
    risk: {
      type: riskType,
      entityId: safeEntityId,
      riskKey: toStringOr(riskRecord?.risk_key, toRiskKey(riskType, safeEntityId)),
    },
  };
};

const parseMaintenanceRiskItems = (value: unknown): DashboardMaintenanceRiskItem[] =>
  asArray(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      return {
        id: toStringOr(row.id),
        assetId: toStringOr(row.asset_id),
        assetName: toStringOr(row.asset_name, "Bilinmeyen Varlik"),
        ruleTitle: toStringOr(row.rule_title),
        dueDate: toStringOr(row.due_date),
        dayCount: toInteger(row.day_count as number | string | null | undefined),
      } satisfies DashboardMaintenanceRiskItem;
    })
    .filter((item): item is DashboardMaintenanceRiskItem => !!item && item.id.length > 0 && item.assetId.length > 0)
    .slice(0, 10);

const parseWarrantyRiskItems = (value: unknown): DashboardWarrantyRiskItem[] =>
  asArray(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      return {
        id: toStringOr(row.id),
        assetId: toStringOr(row.asset_id),
        assetName: toStringOr(row.asset_name, "Bilinmeyen Varlik"),
        warrantyEndDate: toStringOr(row.warranty_end_date),
        daysRemaining: toInteger(row.days_remaining as number | string | null | undefined),
      } satisfies DashboardWarrantyRiskItem;
    })
    .filter((item): item is DashboardWarrantyRiskItem => !!item && item.id.length > 0 && item.assetId.length > 0)
    .slice(0, 10);

const parsePaymentRiskItems = (value: unknown): DashboardPaymentRiskItem[] =>
  asArray(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      const status = toStringOr(row.status) === "overdue" ? "overdue" : "pending";

      return {
        id: toStringOr(row.id),
        invoiceNo: typeof row.invoice_no === "string" ? row.invoice_no : null,
        subscriptionName: toStringOr(row.subscription_name, "Abonelik"),
        dueDate: toStringOr(row.due_date),
        totalAmount: toNumber(row.total_amount as number | string | null | undefined),
        status,
        daysRemaining: Math.round(toNumber(row.days_remaining as number | string | null | undefined)),
      } satisfies DashboardPaymentRiskItem;
    })
    .filter((item): item is DashboardPaymentRiskItem => !!item && item.id.length > 0)
    .slice(0, 10);

const parseMissingDocumentRiskItems = (value: unknown): DashboardMissingDocumentRiskItem[] =>
  asArray(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      return {
        id: toStringOr(row.id),
        assetId: toStringOr(row.asset_id),
        assetName: toStringOr(row.asset_name, "Bilinmeyen Varlik"),
        createdAt: toStringOr(row.created_at),
        daysWithoutDocument: toInteger(row.days_without_document as number | string | null | undefined),
      } satisfies DashboardMissingDocumentRiskItem;
    })
    .filter((item): item is DashboardMissingDocumentRiskItem => !!item && item.id.length > 0 && item.assetId.length > 0)
    .slice(0, 10);

const parseRecentActivity = (value: unknown): DashboardActivityItem[] =>
  asArray(value)
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;

      const typeCandidate = toStringOr(row.type);
      if (!ALLOWED_ACTIVITY_TYPES.has(typeCandidate as DashboardActivityType)) {
        return null;
      }

      return {
        id: toStringOr(row.id),
        type: typeCandidate as DashboardActivityType,
        title: toStringOr(row.title),
        description: toStringOr(row.description),
        date: toStringOr(row.date),
        href: toStringOr(row.href, "/timeline"),
      } satisfies DashboardActivityItem;
    })
    .filter((item): item is DashboardActivityItem => !!item && item.id.length > 0)
    .slice(0, 20);

const EMPTY_DASHBOARD_DATA: DashboardSnapshot = {
  metrics: {
    totalAssets: 0,
    activeRules: 0,
    totalServiceCost: 0,
    documentCount: 0,
    subscriptionCount: 0,
    invoiceCount: 0,
    documentsTotalSize: 0,
    invoicesTotalAmount: 0,
  },
  trends: {
    totalAssets: { direction: "flat", percentage: 0, sparkline: createSparkline("flat") },
    activeRules: { direction: "flat", percentage: 0, sparkline: createSparkline("flat") },
    totalServiceCost: { direction: "flat", percentage: 0, sparkline: createSparkline("flat") },
    documentCount: { direction: "flat", percentage: 0, sparkline: createSparkline("flat") },
  },
  status: {
    tone: "stable",
    headline: "Stabil",
    detail: "Sistem durumu veri geldikce otomatik guncellenecek.",
    riskCount: 0,
    risk: {
      type: "notification_prefs",
      entityId: null,
      riskKey: toRiskKey("notification_prefs"),
    },
  },
  riskPanel: {
    overdueMaintenance: [],
    upcomingMaintenance: [],
    upcomingWarranty: [],
    upcomingPayments: [],
    missingDocuments: [],
  },
  recentActivity: [],
};

export function mapDashboardSnapshotRpcPayload(payload: unknown): DashboardSnapshot {
  const root = asRecord(payload) as DashboardSnapshotRpcPayload | null;
  if (!root) {
    return EMPTY_DASHBOARD_DATA;
  }

  const counts = asRecord(root.counts);
  const sums = asRecord(root.sums);
  const metrics = asRecord(root.metrics);
  const trends = asRecord(root.trends);
  const riskPanel = asRecord(root.risk_panel);

  return {
    metrics: {
      totalAssets: toInteger((metrics?.total_assets ?? counts?.assets_count) as number | string | null | undefined),
      activeRules: toInteger(metrics?.active_rules as number | string | null | undefined),
      totalServiceCost: toNumber((metrics?.total_service_cost ?? sums?.total_cost) as number | string | null | undefined),
      documentCount: toInteger((metrics?.document_count ?? counts?.documents_count) as number | string | null | undefined),
      subscriptionCount: toInteger(
        (metrics?.subscription_count ?? counts?.subscriptions_count) as number | string | null | undefined,
      ),
      invoiceCount: toInteger((metrics?.invoice_count ?? counts?.invoices_count) as number | string | null | undefined),
      documentsTotalSize: toNumber(sums?.documents_total_size as number | string | null | undefined),
      invoicesTotalAmount: toNumber(sums?.invoices_total_amount as number | string | null | undefined),
    },
    trends: {
      totalAssets: parseTrend(trends?.total_assets),
      activeRules: parseTrend(trends?.active_rules),
      totalServiceCost: parseTrend(trends?.total_service_cost),
      documentCount: parseTrend(trends?.document_count),
    },
    status: parseStatus(root.status),
    riskPanel: {
      overdueMaintenance: parseMaintenanceRiskItems(riskPanel?.overdue_maintenance),
      upcomingMaintenance: parseMaintenanceRiskItems(riskPanel?.upcoming_maintenance),
      upcomingWarranty: parseWarrantyRiskItems(riskPanel?.upcoming_warranty),
      upcomingPayments: parsePaymentRiskItems(riskPanel?.upcoming_payments),
      missingDocuments: parseMissingDocumentRiskItems(riskPanel?.missing_documents),
    },
    recentActivity: parseRecentActivity(root.timeline),
  };
}

export async function getDashboardSnapshot(
  client: DbClient,
  userId: string,
  options?: { rangeDays?: DashboardDateRangeDays },
): Promise<DashboardSnapshotResult> {
  const rangeDays = options?.rangeDays ?? 30;

  const today = startOfToday();
  const currentPeriodStart = addDays(today, -(rangeDays - 1));
  const tomorrow = addDays(today, 1);

  const rpcClient = client as unknown as {
    rpc: (
      fn: "get_dashboard_snapshot",
      args: { p_from: string; p_to: string; p_user_id: string },
    ) => Promise<{ data: unknown; error: PostgrestError | null }>;
  };

  const { data, error } = await rpcClient.rpc("get_dashboard_snapshot", {
    p_user_id: userId,
    p_from: currentPeriodStart.toISOString(),
    p_to: tomorrow.toISOString(),
  });

  if (error) {
    return {
      data: EMPTY_DASHBOARD_DATA,
      isMock: false,
      warning: toDashboardSnapshotWarning(error),
    };
  }

  const payload = Array.isArray(data) ? data[0] : data;
  const snapshot = mapDashboardSnapshotRpcPayload(payload);

  return {
    data: snapshot,
    isMock: false,
    warning: null,
  };
}
