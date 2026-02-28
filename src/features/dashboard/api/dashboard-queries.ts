import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient, Row } from "@/lib/repos/_shared";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DashboardAssetRow = Pick<Row<"assets">, "id" | "name" | "category" | "warranty_end_date" | "created_at">;
type DashboardRuleRow = Pick<Row<"maintenance_rules">, "id" | "asset_id" | "title" | "next_due_date" | "is_active" | "created_at">;
type DashboardServiceLogRow = Pick<
  Row<"service_logs">,
  "id" | "asset_id" | "service_type" | "service_date" | "cost" | "created_at"
>;
type DashboardDocumentRow = Pick<Row<"documents">, "id" | "asset_id" | "file_name" | "uploaded_at">;
type DashboardSubscriptionRow = Pick<Row<"billing_subscriptions">, "id" | "provider_name" | "subscription_name">;
type DashboardInvoiceRow = Pick<
  Row<"billing_invoices">,
  "id" | "subscription_id" | "invoice_no" | "due_date" | "total_amount" | "status" | "created_at" | "paid_at"
>;

type DashboardAggregateRpcRow = {
  total_assets: number | string | null;
  active_rules: number | string | null;
  document_count: number | string | null;
  documented_asset_count: number | string | null;
  subscription_count: number | string | null;
  invoice_count: number | string | null;
  total_service_cost: number | string | null;
  current_assets_created: number | string | null;
  previous_assets_created: number | string | null;
  current_rules_created: number | string | null;
  previous_rules_created: number | string | null;
  current_service_cost: number | string | null;
  previous_service_cost: number | string | null;
  current_documents_uploaded: number | string | null;
  previous_documents_uploaded: number | string | null;
};

type DashboardMissingDocumentRpcRow = {
  asset_id: string;
  asset_name: string;
  created_at: string;
  days_without_document: number | string;
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

const parseDate = (value: string) => new Date(value.includes("T") ? value : `${value}T00:00:00`);
const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const toRiskKey = (type: DashboardSystemRiskType, entityId?: string | null) => `${type}:${entityId ?? "global"}`;

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_IN_MS);

const dayDiff = (date: Date, from: Date) => {
  const diff = date.getTime() - from.getTime();
  return Math.ceil(diff / DAY_IN_MS);
};

const createSparkline = (direction: DashboardTrendDirection) => {
  if (direction === "up") return [22, 24, 28, 30, 34, 37];
  if (direction === "down") return [37, 34, 31, 28, 25, 22];
  return [28, 27, 28, 27, 28, 27];
};

const buildTrend = (current: number, previous: number): DashboardKpiTrend => {
  if (current <= 0 && previous <= 0) {
    return {
      direction: "flat",
      percentage: 0,
      sparkline: createSparkline("flat"),
    };
  }

  if (previous <= 0 && current > 0) {
    return {
      direction: "up",
      percentage: 100,
      sparkline: createSparkline("up"),
    };
  }

  const delta = current - previous;
  const direction: DashboardTrendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const percentage = Math.min(999, Math.round((Math.abs(delta) / Math.abs(previous || 1)) * 100));

  return {
    direction,
    percentage,
    sparkline: createSparkline(direction),
  };
};

const toMaintenanceRisk = (
  rules: DashboardRuleRow[],
  assetsById: Map<string, DashboardAssetRow>,
  today: Date,
) => {
  const overdue: DashboardMaintenanceRiskItem[] = [];
  const upcoming: DashboardMaintenanceRiskItem[] = [];

  for (const rule of rules) {
    if (!rule.is_active) continue;
    const asset = assetsById.get(rule.asset_id);
    if (!asset) continue;

    const dueDate = parseDate(rule.next_due_date);
    const dueInDays = dayDiff(dueDate, today);

    if (dueInDays < 0) {
      overdue.push({
        id: rule.id,
        assetId: asset.id,
        assetName: asset.name,
        ruleTitle: rule.title,
        dueDate: rule.next_due_date,
        dayCount: Math.abs(dueInDays),
      });
      continue;
    }

    if (dueInDays <= 7) {
      upcoming.push({
        id: rule.id,
        assetId: asset.id,
        assetName: asset.name,
        ruleTitle: rule.title,
        dueDate: rule.next_due_date,
        dayCount: dueInDays,
      });
    }
  }

  overdue.sort((a, b) => b.dayCount - a.dayCount);
  upcoming.sort((a, b) => a.dayCount - b.dayCount);

  return {
    overdueMaintenance: overdue.slice(0, 6),
    upcomingMaintenance: upcoming.slice(0, 6),
  };
};

const toWarrantyRisk = (assets: DashboardAssetRow[], today: Date) =>
  assets
    .filter((asset) => !!asset.warranty_end_date)
    .map((asset) => {
      const warrantyEndDate = asset.warranty_end_date as string;
      const daysRemaining = dayDiff(parseDate(warrantyEndDate), today);
      return {
        id: asset.id,
        assetId: asset.id,
        assetName: asset.name,
        warrantyEndDate,
        daysRemaining,
      };
    })
    .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 6);

const toPaymentRisk = (
  invoices: DashboardInvoiceRow[],
  subscriptionNameById: Map<string, string>,
  today: Date,
) =>
  invoices
    .filter((invoice) => !!invoice.due_date && (invoice.status === "pending" || invoice.status === "overdue"))
    .map((invoice) => {
      const dueDate = invoice.due_date as string;
      return {
        id: invoice.id,
        invoiceNo: invoice.invoice_no,
        subscriptionName: subscriptionNameById.get(invoice.subscription_id) ?? "Abonelik",
        dueDate,
        totalAmount: Number(invoice.total_amount ?? 0),
        status: invoice.status as "pending" | "overdue",
        daysRemaining: dayDiff(parseDate(dueDate), today),
      } as DashboardPaymentRiskItem;
    })
    .filter((invoice) => invoice.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 6);

const toRecentActivity = (
  assetsById: Map<string, DashboardAssetRow>,
  serviceLogs: DashboardServiceLogRow[],
  documents: DashboardDocumentRow[],
  rules: DashboardRuleRow[],
  paidInvoices: DashboardInvoiceRow[],
  subscriptionNameById: Map<string, string>,
) => {
  const events: DashboardActivityItem[] = [];

  for (const log of serviceLogs.slice(0, 10)) {
    const assetName = assetsById.get(log.asset_id)?.name ?? "Bilinmeyen Varlik";
    events.push({
      id: `service-${log.id}`,
      type: "service",
      title: "Servis kaydi eklendi",
      description: `${assetName} - ${log.service_type}`,
      date: log.created_at,
      href: `/services?asset=${log.asset_id}`,
    });
  }

  for (const document of documents.slice(0, 10)) {
    const assetName = assetsById.get(document.asset_id)?.name ?? "Bilinmeyen Varlik";
    events.push({
      id: `document-${document.id}`,
      type: "document",
      title: "Belge yuklendi",
      description: `${assetName} - ${document.file_name}`,
      date: document.uploaded_at,
      href: `/documents?asset=${document.asset_id}`,
    });
  }

  for (const rule of rules.slice(0, 10)) {
    const assetName = assetsById.get(rule.asset_id)?.name ?? "Bilinmeyen Varlik";
    events.push({
      id: `rule-${rule.id}`,
      type: "rule",
      title: "Bakim kurali olusturuldu",
      description: `${assetName} - ${rule.title}`,
      date: rule.created_at,
      href: `/maintenance?asset=${rule.asset_id}`,
    });
  }

  for (const invoice of paidInvoices.slice(0, 10)) {
    const subscriptionName = subscriptionNameById.get(invoice.subscription_id) ?? "Abonelik";
    const paymentDate = invoice.paid_at ?? invoice.created_at;
    events.push({
      id: `payment-${invoice.id}`,
      type: "payment",
      title: "Odeme islendi",
      description: `${subscriptionName} - ${Number(invoice.total_amount ?? 0).toFixed(2)} TL`,
      date: paymentDate,
      href: "/invoices",
    });
  }

  return events
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
    .slice(0, 10);
};

const toSystemStatus = ({
  hasData,
  assetCount,
  activeRuleCount,
  overdueMaintenanceCount,
  overduePaymentCount,
  upcomingPaymentCount,
  missingDocumentCount,
  warningCount,
}: {
  hasData: boolean;
  assetCount: number;
  activeRuleCount: number;
  overdueMaintenanceCount: number;
  overduePaymentCount: number;
  upcomingPaymentCount: number;
  missingDocumentCount: number;
  warningCount: number;
}): DashboardSystemStatus => {
  if (!hasData) {
    return {
      tone: "stable",
      headline: "Stabil",
      detail: "Sistem durumu veri geldikce otomatik guncellenecek.",
      riskCount: 0,
      risk: {
        type: "notification_prefs",
        entityId: null,
        riskKey: toRiskKey("notification_prefs"),
      },
    };
  }

  if (overdueMaintenanceCount > 0) {
    return {
      tone: "critical",
      headline: `${overdueMaintenanceCount} gecikmis bakim`,
      detail: "Bakim takvimi plani gerisinde. Hemen aksiyon alin.",
      riskCount: overdueMaintenanceCount + overduePaymentCount + warningCount,
      risk: {
        type: "maintenance_due",
        entityId: null,
        riskKey: toRiskKey("maintenance_due"),
      },
    };
  }

  if (overduePaymentCount > 0) {
    return {
      tone: "critical",
      headline: `${overduePaymentCount} gecikmis odeme`,
      detail: "Finans kayitlari gecikmede. Vade durumunu kontrol edin.",
      riskCount: overduePaymentCount + warningCount,
      risk: {
        type: "invoice_due",
        entityId: null,
        riskKey: toRiskKey("invoice_due"),
      },
    };
  }

  if (assetCount > 0 && activeRuleCount === 0) {
    return {
      tone: "warning",
      headline: "Bakim kurali eksik",
      detail: "Varliklar icin en az bir bakim kurali tanimlayarak riski azaltin.",
      riskCount: Math.max(1, warningCount),
      risk: {
        type: "rule_missing",
        entityId: null,
        riskKey: toRiskKey("rule_missing"),
      },
    };
  }

  if (warningCount > 0) {
    if (missingDocumentCount > 0) {
      return {
        tone: "warning",
        headline: `${warningCount} risk var`,
        detail: "Yaklasan takvimler icin onleyici adim alinmasi onerilir.",
        riskCount: warningCount,
        risk: {
          type: "document_missing",
          entityId: null,
          riskKey: toRiskKey("document_missing"),
        },
      };
    }

    if (upcomingPaymentCount > 0) {
      return {
        tone: "warning",
        headline: `${warningCount} risk var`,
        detail: "Yaklasan takvimler icin onleyici adim alinmasi onerilir.",
        riskCount: warningCount,
        risk: {
          type: "invoice_due",
          entityId: null,
          riskKey: toRiskKey("invoice_due"),
        },
      };
    }

    return {
      tone: "warning",
      headline: `${warningCount} risk var`,
      detail: "Yaklasan takvimler icin onleyici adim alinmasi onerilir.",
      riskCount: warningCount,
      risk: {
        type: "maintenance_due",
        entityId: null,
        riskKey: toRiskKey("maintenance_due"),
      },
    };
  }

  return {
    tone: "healthy",
    headline: "Her sey yolunda",
    detail: "Kritik veya yaklasan risk kaydi su an bulunmuyor.",
    riskCount: 0,
    risk: {
      type: "notification_prefs",
      entityId: null,
      riskKey: toRiskKey("notification_prefs"),
    },
  };
};

const isMissingRelationError = (error: PostgrestError | null) =>
  !!error && (error.code === "42P01" || error.message.toLocaleLowerCase("en-US").includes("does not exist"));

const MISSING_RPC_FUNCTION_CODES = new Set(["42883", "PGRST202"]);

const isMissingRpcFunctionError = (error: PostgrestError | null, functionName: string) => {
  if (!error) return false;

  const needle = functionName.toLocaleLowerCase("en-US");
  const haystack = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLocaleLowerCase("en-US");

  return (
    MISSING_RPC_FUNCTION_CODES.has(error.code ?? "") ||
    (haystack.includes("function") && haystack.includes("does not exist") && haystack.includes(needle)) ||
    (haystack.includes("could not find the function") && haystack.includes(needle))
  );
};

const buildAggregateFallback = async (
  client: DbClient,
  userId: string,
  params: {
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    previousPeriodStart: Date;
    previousPeriodEnd: Date;
  },
): Promise<{ data: DashboardAggregateRpcRow[]; error: PostgrestError | null }> => {
  const currentPeriodStartIso = params.currentPeriodStart.toISOString();
  const currentPeriodEndIso = params.currentPeriodEnd.toISOString();
  const previousPeriodStartIso = params.previousPeriodStart.toISOString();
  const previousPeriodEndIso = params.previousPeriodEnd.toISOString();

  const currentPeriodStartDate = toDateOnly(params.currentPeriodStart);
  const currentPeriodEndDate = toDateOnly(params.currentPeriodEnd);
  const previousPeriodStartDate = toDateOnly(params.previousPeriodStart);
  const previousPeriodEndDate = toDateOnly(params.previousPeriodEnd);

  const [
    totalAssetsRes,
    activeRulesRes,
    documentCountRes,
    currentAssetsCreatedRes,
    previousAssetsCreatedRes,
    currentRulesCreatedRes,
    previousRulesCreatedRes,
    currentDocumentsUploadedRes,
    previousDocumentsUploadedRes,
    serviceLogsRes,
    documentedAssetsRes,
  ] = await Promise.all([
    client.from("assets").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("maintenance_rules").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_active", true),
    client.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", currentPeriodStartIso)
      .lt("created_at", currentPeriodEndIso),
    client
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", previousPeriodStartIso)
      .lt("created_at", previousPeriodEndIso),
    client
      .from("maintenance_rules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
      .gte("created_at", currentPeriodStartIso)
      .lt("created_at", currentPeriodEndIso),
    client
      .from("maintenance_rules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
      .gte("created_at", previousPeriodStartIso)
      .lt("created_at", previousPeriodEndIso),
    client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("uploaded_at", currentPeriodStartIso)
      .lt("uploaded_at", currentPeriodEndIso),
    client
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("uploaded_at", previousPeriodStartIso)
      .lt("uploaded_at", previousPeriodEndIso),
    client.from("service_logs").select("cost,service_date").eq("user_id", userId),
    client.from("documents").select("asset_id").eq("user_id", userId).not("asset_id", "is", null),
  ]);

  const fallbackError =
    totalAssetsRes.error ??
    activeRulesRes.error ??
    documentCountRes.error ??
    currentAssetsCreatedRes.error ??
    previousAssetsCreatedRes.error ??
    currentRulesCreatedRes.error ??
    previousRulesCreatedRes.error ??
    currentDocumentsUploadedRes.error ??
    previousDocumentsUploadedRes.error ??
    serviceLogsRes.error ??
    documentedAssetsRes.error ??
    null;

  if (fallbackError) {
    return { data: [], error: fallbackError };
  }

  const serviceLogs = (serviceLogsRes.data ?? []) as Array<{ cost: number | string | null; service_date: string }>;

  let totalServiceCost = 0;
  let currentServiceCost = 0;
  let previousServiceCost = 0;

  for (const log of serviceLogs) {
    const cost = toNumber(log.cost);
    totalServiceCost += cost;

    if (log.service_date >= currentPeriodStartDate && log.service_date < currentPeriodEndDate) {
      currentServiceCost += cost;
    }
    if (log.service_date >= previousPeriodStartDate && log.service_date < previousPeriodEndDate) {
      previousServiceCost += cost;
    }
  }

  const documentedAssets = (documentedAssetsRes.data ?? []) as Array<{ asset_id: string | null }>;
  const documentedAssetCount = new Set(
    documentedAssets
      .map((row) => row.asset_id)
      .filter((assetId): assetId is string => typeof assetId === "string" && assetId.length > 0),
  ).size;

  return {
    data: [
      {
        total_assets: totalAssetsRes.count ?? 0,
        active_rules: activeRulesRes.count ?? 0,
        document_count: documentCountRes.count ?? 0,
        documented_asset_count: documentedAssetCount,
        subscription_count: null,
        invoice_count: null,
        total_service_cost: totalServiceCost,
        current_assets_created: currentAssetsCreatedRes.count ?? 0,
        previous_assets_created: previousAssetsCreatedRes.count ?? 0,
        current_rules_created: currentRulesCreatedRes.count ?? 0,
        previous_rules_created: previousRulesCreatedRes.count ?? 0,
        current_service_cost: currentServiceCost,
        previous_service_cost: previousServiceCost,
        current_documents_uploaded: currentDocumentsUploadedRes.count ?? 0,
        previous_documents_uploaded: previousDocumentsUploadedRes.count ?? 0,
      },
    ],
    error: null,
  };
};

const buildMissingDocumentsFallback = async (
  client: DbClient,
  userId: string,
  options?: { limit?: number; today?: Date },
): Promise<{ data: DashboardMissingDocumentRpcRow[]; error: PostgrestError | null }> => {
  const safeLimit = Math.max(1, Math.min(Math.round(options?.limit ?? 6), 50));
  const today = options?.today ?? startOfToday();

  const [assetsRes, documentedAssetsRes] = await Promise.all([
    client.from("assets").select("id,name,created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    client.from("documents").select("asset_id").eq("user_id", userId).not("asset_id", "is", null),
  ]);

  const fallbackError = assetsRes.error ?? documentedAssetsRes.error ?? null;
  if (fallbackError) {
    return { data: [], error: fallbackError };
  }

  const documentedAssetIds = new Set(
    ((documentedAssetsRes.data ?? []) as Array<{ asset_id: string | null }>)
      .map((row) => row.asset_id)
      .filter((assetId): assetId is string => typeof assetId === "string" && assetId.length > 0),
  );

  const missingRows = ((assetsRes.data ?? []) as Array<{ id: string; name: string; created_at: string }>)
    .filter((asset) => !documentedAssetIds.has(asset.id))
    .slice(0, safeLimit)
    .map((asset) => {
      const createdAt = parseDate(asset.created_at);
      const createdAtMs = createdAt.getTime();
      const daysWithoutDocument = Number.isFinite(createdAtMs)
        ? Math.max(0, Math.floor((today.getTime() - createdAtMs) / DAY_IN_MS))
        : 0;

      return {
        asset_id: asset.id,
        asset_name: asset.name,
        created_at: asset.created_at,
        days_without_document: daysWithoutDocument,
      };
    });

  return { data: missingRows, error: null };
};

const EMPTY_DASHBOARD_DATA: DashboardSnapshot = {
  metrics: {
    totalAssets: 0,
    activeRules: 0,
    totalServiceCost: 0,
    documentCount: 0,
    subscriptionCount: 0,
    invoiceCount: 0,
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

export async function getDashboardSnapshot(
  client: DbClient,
  userId: string,
  options?: { rangeDays?: DashboardDateRangeDays },
): Promise<DashboardSnapshotResult> {
  const rangeDays = options?.rangeDays ?? 30;

  const today = startOfToday();
  const currentPeriodStart = addDays(today, -(rangeDays - 1));
  const previousPeriodStart = addDays(currentPeriodStart, -rangeDays);
  const tomorrow = addDays(today, 1);
  const thirtyDaysLater = addDays(today, 30);

  const rpcClient = client as unknown as {
    rpc: (
      fn: "get_dashboard_aggregates" | "get_dashboard_missing_documents",
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: PostgrestError | null }>;
  };

  const [aggregateRes, riskRulesRes, recentRulesRes, recentServiceLogsRes, recentDocumentsRes, missingDocumentsRes] =
    await Promise.all([
      rpcClient.rpc("get_dashboard_aggregates", {
        p_user_id: userId,
        p_current_start: toDateOnly(currentPeriodStart),
        p_current_end: toDateOnly(tomorrow),
        p_previous_start: toDateOnly(previousPeriodStart),
        p_previous_end: toDateOnly(currentPeriodStart),
      }),
      client
        .from("maintenance_rules")
        .select("id,asset_id,title,next_due_date,is_active,created_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .lte("next_due_date", toDateOnly(addDays(today, 7)))
        .order("next_due_date", { ascending: true })
        .limit(200),
      client
        .from("maintenance_rules")
        .select("id,asset_id,title,next_due_date,is_active,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("service_logs")
        .select("id,asset_id,service_type,service_date,cost,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("documents")
        .select("id,asset_id,file_name,uploaded_at")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false })
        .limit(10),
      rpcClient.rpc("get_dashboard_missing_documents", {
        p_user_id: userId,
        p_limit: 6,
      }),
    ]);

  let aggregateResult = aggregateRes;
  if (aggregateResult.error && isMissingRpcFunctionError(aggregateResult.error, "get_dashboard_aggregates")) {
    const aggregateFallback = await buildAggregateFallback(client, userId, {
      currentPeriodStart,
      currentPeriodEnd: tomorrow,
      previousPeriodStart,
      previousPeriodEnd: currentPeriodStart,
    });
    if (!aggregateFallback.error) {
      aggregateResult = { data: aggregateFallback.data, error: null };
    }
  }

  let missingDocumentsResult = missingDocumentsRes;
  if (
    missingDocumentsResult.error &&
    isMissingRpcFunctionError(missingDocumentsResult.error, "get_dashboard_missing_documents")
  ) {
    const missingDocumentsFallback = await buildMissingDocumentsFallback(client, userId, {
      limit: 6,
      today,
    });
    if (!missingDocumentsFallback.error) {
      missingDocumentsResult = { data: missingDocumentsFallback.data, error: null };
    }
  }

  const coreWarnings: string[] = [];
  if (aggregateResult.error) coreWarnings.push("Dashboard aggregate verisi alinamadi.");
  if (riskRulesRes.error) coreWarnings.push("Bakim kurallari alinamadi.");
  if (recentRulesRes.error) coreWarnings.push("Bakim aktivitesi alinamadi.");
  if (recentServiceLogsRes.error) coreWarnings.push("Servis kayitlari alinamadi.");
  if (recentDocumentsRes.error) coreWarnings.push("Belge listesi alinamadi.");
  if (missingDocumentsResult.error) coreWarnings.push("Eksik belge riski alinamadi.");

  const allCoreQueriesFailed =
    !!aggregateResult.error &&
    !!riskRulesRes.error &&
    !!recentRulesRes.error &&
    !!recentServiceLogsRes.error &&
    !!recentDocumentsRes.error &&
    !!missingDocumentsResult.error;

  if (allCoreQueriesFailed) {
    return {
      data: EMPTY_DASHBOARD_DATA,
      isMock: false,
      warning: "Canli veriler alinamadi. Dashboard sifir metriklerle gosteriliyor.",
    };
  }

  const [warrantyRiskRes, overdueMaintenanceCountRes] = await Promise.all([
    client
      .from("assets")
      .select("id,name,category,warranty_end_date,created_at")
      .eq("user_id", userId)
      .not("warranty_end_date", "is", null)
      .gte("warranty_end_date", toDateOnly(today))
      .lte("warranty_end_date", toDateOnly(thirtyDaysLater))
      .order("warranty_end_date", { ascending: true })
      .limit(20),
    client
      .from("maintenance_rules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)
      .lt("next_due_date", toDateOnly(today)),
  ]);

  if (warrantyRiskRes.error) {
    coreWarnings.push("Garanti riski verisi alinamadi.");
  }
  if (overdueMaintenanceCountRes.error) {
    coreWarnings.push("Gecikmis bakim sayisi alinamadi.");
  }

  const optionalWarnings: string[] = [];
  const [subscriptionCountRes, invoiceCountRes, subscriptionsRes, paymentRiskRes, paidInvoicesRes] = await Promise.all([
    client.from("billing_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("billing_invoices").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("billing_subscriptions").select("id,provider_name,subscription_name").eq("user_id", userId),
    client
      .from("billing_invoices")
      .select("id,subscription_id,invoice_no,due_date,total_amount,status,created_at,paid_at")
      .eq("user_id", userId)
      .in("status", ["pending", "overdue"])
      .not("due_date", "is", null)
      .lte("due_date", toDateOnly(thirtyDaysLater))
      .order("due_date", { ascending: true })
      .limit(40),
    client
      .from("billing_invoices")
      .select("id,subscription_id,invoice_no,due_date,total_amount,status,created_at,paid_at")
      .eq("user_id", userId)
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false })
      .limit(10),
  ]);

  if (subscriptionCountRes.error && !isMissingRelationError(subscriptionCountRes.error)) {
    optionalWarnings.push("Abonelik limiti verisi alinamadi.");
  }
  if (invoiceCountRes.error && !isMissingRelationError(invoiceCountRes.error)) {
    optionalWarnings.push("Fatura limiti verisi alinamadi.");
  }
  if (subscriptionsRes.error && !isMissingRelationError(subscriptionsRes.error)) {
    optionalWarnings.push("Abonelik listesi alinamadi.");
  }
  if (paymentRiskRes.error && !isMissingRelationError(paymentRiskRes.error)) {
    optionalWarnings.push("Odeme riski verisi alinamadi.");
  }
  if (paidInvoicesRes.error && !isMissingRelationError(paidInvoicesRes.error)) {
    optionalWarnings.push("Odeme aktivitesi alinamadi.");
  }

  const aggregateRows = Array.isArray(aggregateResult.data)
    ? ((aggregateResult.data as DashboardAggregateRpcRow[]) ?? [])
    : [];
  const aggregate = aggregateRows[0] ?? null;

  const riskRules = riskRulesRes.error ? [] : ((riskRulesRes.data ?? []) as DashboardRuleRow[]);
  const rules = recentRulesRes.error ? [] : ((recentRulesRes.data ?? []) as DashboardRuleRow[]);
  const serviceLogs = recentServiceLogsRes.error
    ? []
    : ((recentServiceLogsRes.data ?? []) as DashboardServiceLogRow[]);
  const documents = recentDocumentsRes.error ? [] : ((recentDocumentsRes.data ?? []) as DashboardDocumentRow[]);
  const warrantyAssets = warrantyRiskRes.error ? [] : ((warrantyRiskRes.data ?? []) as DashboardAssetRow[]);
  const subscriptions = (subscriptionsRes.data ?? []) as DashboardSubscriptionRow[];
  const paymentRiskInvoices = (paymentRiskRes.data ?? []) as DashboardInvoiceRow[];
  const paidInvoices = (paidInvoicesRes.data ?? []) as DashboardInvoiceRow[];
  const missingDocumentRows = missingDocumentsResult.error
    ? []
    : (((missingDocumentsResult.data ?? []) as DashboardMissingDocumentRpcRow[]) ?? []);

  const assetIdsForNameLookup = new Set<string>();
  for (const row of [...riskRules, ...rules]) assetIdsForNameLookup.add(row.asset_id);
  for (const row of serviceLogs) assetIdsForNameLookup.add(row.asset_id);
  for (const row of documents) assetIdsForNameLookup.add(row.asset_id);
  for (const row of warrantyAssets) assetIdsForNameLookup.add(row.id);
  for (const row of missingDocumentRows) assetIdsForNameLookup.add(row.asset_id);

  let assetLookupRows: DashboardAssetRow[] = [];
  if (assetIdsForNameLookup.size > 0) {
    const { data: assetLookupData, error: assetLookupError } = await client
      .from("assets")
      .select("id,name,category,warranty_end_date,created_at")
      .eq("user_id", userId)
      .in("id", [...assetIdsForNameLookup]);

    if (assetLookupError) {
      coreWarnings.push("Varlik adi lookup sorgusu basarisiz.");
    } else {
      assetLookupRows = (assetLookupData ?? []) as DashboardAssetRow[];
    }
  }

  const assetsById = new Map(assetLookupRows.map((asset) => [asset.id, asset]));
  for (const asset of warrantyAssets) {
    if (!assetsById.has(asset.id)) {
      assetsById.set(asset.id, asset);
    }
  }
  for (const missing of missingDocumentRows) {
    if (!assetsById.has(missing.asset_id)) {
      assetsById.set(missing.asset_id, {
        id: missing.asset_id,
        name: missing.asset_name,
        category: "",
        warranty_end_date: null,
        created_at: missing.created_at,
      });
    }
  }

  const subscriptionNameById = new Map(
    subscriptions.map((subscription) => [
      subscription.id,
      `${subscription.provider_name} - ${subscription.subscription_name}`,
    ]),
  );

  const maintenanceRisk = toMaintenanceRisk(riskRules, assetsById, today);
  const warrantyRisk = toWarrantyRisk(warrantyAssets, today);
  const paymentRisk = toPaymentRisk(paymentRiskInvoices, subscriptionNameById, today);
  const missingDocuments = missingDocumentRows.map((row) => ({
    id: row.asset_id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    createdAt: row.created_at,
    daysWithoutDocument: Math.max(0, Math.round(toNumber(row.days_without_document))),
  }));

  const totalAssets = Math.round(toNumber(aggregate?.total_assets));
  const activeRules = Math.round(toNumber(aggregate?.active_rules));
  const documentCount = Math.round(toNumber(aggregate?.document_count));
  const documentedAssetCount = Math.round(toNumber(aggregate?.documented_asset_count));
  const totalServiceCost = toNumber(aggregate?.total_service_cost);

  const currentAssetsCreated = Math.round(toNumber(aggregate?.current_assets_created));
  const previousAssetsCreated = Math.round(toNumber(aggregate?.previous_assets_created));
  const currentRulesCreated = Math.round(toNumber(aggregate?.current_rules_created));
  const previousRulesCreated = Math.round(toNumber(aggregate?.previous_rules_created));
  const currentServiceCost = toNumber(aggregate?.current_service_cost);
  const previousServiceCost = toNumber(aggregate?.previous_service_cost);
  const currentDocumentsUploaded = Math.round(toNumber(aggregate?.current_documents_uploaded));
  const previousDocumentsUploaded = Math.round(toNumber(aggregate?.previous_documents_uploaded));

  const overdueMaintenanceCount = overdueMaintenanceCountRes.count ?? maintenanceRisk.overdueMaintenance.length;
  const overduePaymentCount = paymentRisk.filter((item) => item.daysRemaining < 0).length;
  const upcomingPaymentCount = paymentRisk.filter((item) => item.daysRemaining >= 0).length;
  const missingDocumentCount = Math.max(0, totalAssets - documentedAssetCount);
  const warningCount =
    maintenanceRisk.upcomingMaintenance.length +
    warrantyRisk.length +
    upcomingPaymentCount +
    missingDocuments.length;

  const hasData = totalAssets > 0 || activeRules > 0 || documentCount > 0 || totalServiceCost > 0;
  const warningParts = [...coreWarnings, ...optionalWarnings];
  const warning = warningParts.length > 0 ? warningParts.join(" ") : null;

  return {
    data: {
      metrics: {
        totalAssets,
        activeRules,
        totalServiceCost,
        documentCount,
        subscriptionCount: Math.round(toNumber(aggregate?.subscription_count ?? subscriptionCountRes.count ?? 0)),
        invoiceCount: Math.round(toNumber(aggregate?.invoice_count ?? invoiceCountRes.count ?? 0)),
      },
      trends: {
        totalAssets: buildTrend(currentAssetsCreated, previousAssetsCreated),
        activeRules: buildTrend(currentRulesCreated, previousRulesCreated),
        totalServiceCost: buildTrend(currentServiceCost, previousServiceCost),
        documentCount: buildTrend(currentDocumentsUploaded, previousDocumentsUploaded),
      },
      status: toSystemStatus({
        hasData,
        assetCount: totalAssets,
        activeRuleCount: activeRules,
        overdueMaintenanceCount,
        overduePaymentCount,
        upcomingPaymentCount,
        missingDocumentCount,
        warningCount,
      }),
      riskPanel: {
        overdueMaintenance: maintenanceRisk.overdueMaintenance,
        upcomingMaintenance: maintenanceRisk.upcomingMaintenance,
        upcomingWarranty: warrantyRisk,
        upcomingPayments: paymentRisk,
        missingDocuments,
      },
      recentActivity: toRecentActivity(assetsById, serviceLogs, documents, rules, paidInvoices, subscriptionNameById),
    },
    isMock: false,
    warning,
  };
}
