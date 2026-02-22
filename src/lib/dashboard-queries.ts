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

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_IN_MS);

const dayDiff = (date: Date, from: Date) => {
  const diff = date.getTime() - from.getTime();
  return Math.ceil(diff / DAY_IN_MS);
};

const countInRange = <T>(
  items: T[],
  toDate: (item: T) => Date,
  fromInclusive: Date,
  toExclusive: Date,
) =>
  items.reduce((count, item) => {
    const value = toDate(item);
    return value >= fromInclusive && value < toExclusive ? count + 1 : count;
  }, 0);

const sumInRange = <T>(
  items: T[],
  toDate: (item: T) => Date,
  toAmount: (item: T) => number,
  fromInclusive: Date,
  toExclusive: Date,
) =>
  items.reduce((sum, item) => {
    const value = toDate(item);
    if (value < fromInclusive || value >= toExclusive) {
      return sum;
    }
    return sum + toAmount(item);
  }, 0);

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
  const percentage = Math.min(999, Math.round((Math.abs(delta) / Math.abs(previous)) * 100));

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
    .filter((invoice) => !!invoice.due_date)
    .map((invoice) => {
      const dueDate = invoice.due_date as string;
      return {
        id: invoice.id,
        invoiceNo: invoice.invoice_no,
        subscriptionName: subscriptionNameById.get(invoice.subscription_id) ?? "Abonelik",
        dueDate,
        totalAmount: Number(invoice.total_amount ?? 0),
        status: invoice.status,
        daysRemaining: dayDiff(parseDate(dueDate), today),
      } as DashboardPaymentRiskItem;
    })
    .filter((invoice) => invoice.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 6);

const toMissingDocuments = (assets: DashboardAssetRow[], documents: DashboardDocumentRow[], today: Date) => {
  const documentedAssetIds = new Set(documents.map((document) => document.asset_id));

  return assets
    .filter((asset) => !documentedAssetIds.has(asset.id))
    .map((asset) => {
      const createdDate = parseDate(asset.created_at);
      const daysWithoutDocument = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / DAY_IN_MS));

      return {
        id: asset.id,
        assetId: asset.id,
        assetName: asset.name,
        createdAt: asset.created_at,
        daysWithoutDocument,
      };
    })
    .sort((a, b) => b.daysWithoutDocument - a.daysWithoutDocument)
    .slice(0, 6);
};

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
    const assetName = assetsById.get(log.asset_id)?.name ?? "Bilinmeyen Varlık";
    events.push({
      id: `service-${log.id}`,
      type: "service",
      title: "Servis kaydı eklendi",
      description: `${assetName} - ${log.service_type}`,
      date: log.created_at,
      href: `/services?asset=${log.asset_id}`,
    });
  }

  for (const document of documents.slice(0, 10)) {
    const assetName = assetsById.get(document.asset_id)?.name ?? "Bilinmeyen Varlık";
    events.push({
      id: `document-${document.id}`,
      type: "document",
      title: "Belge yüklendi",
      description: `${assetName} - ${document.file_name}`,
      date: document.uploaded_at,
      href: `/documents?asset=${document.asset_id}`,
    });
  }

  for (const rule of rules.slice(0, 10)) {
    const assetName = assetsById.get(rule.asset_id)?.name ?? "Bilinmeyen Varlık";
    events.push({
      id: `rule-${rule.id}`,
      type: "rule",
      title: "Bakım kuralı oluşturuldu",
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
      title: "Ödeme islendi",
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
      detail: "Sistem durumu veri geldikçe otomatik güncellenecek.",
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
      detail: "Bakım takvimi planın gerisinde. Hemen aksiyon alin.",
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
      detail: "Finans kayıtları gecikmede. Vade durumunu kontrol edin.",
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
      headline: "Bakım kuralı eksik",
      detail: "Varlıklar için en az bir bakim kuralı tanımlayarak riski azaltın.",
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
        detail: "Yaklaşan takvimler için önleyici adım alınması önerilir.",
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
        detail: "Yaklaşan takvimler için önleyici adım alınması önerilir.",
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
      detail: "Yaklaşan takvimler için önleyici adım alınması önerilir.",
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
    detail: "Kritik veya yaklasan risk kaydı su an bulunmuyor.",
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
    detail: "Sistem durumu veri geldikçe otomatik güncellenecek.",
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

  const [assetsRes, rulesRes, serviceLogsRes, documentCountRes, documentsRes] = await Promise.all([
    client
      .from("assets")
      .select("id,name,category,warranty_end_date,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("maintenance_rules")
      .select("id,asset_id,title,next_due_date,is_active,created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("next_due_date", { ascending: true }),
    client
      .from("service_logs")
      .select("id,asset_id,service_type,service_date,cost,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1000),
    client.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client
      .from("documents")
      .select("id,asset_id,file_name,uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false })
      .limit(5000),
  ]);

  const coreWarnings: string[] = [];

  if (assetsRes.error) {
    coreWarnings.push("Varlık verisi alınamadı.");
  }
  if (rulesRes.error) {
    coreWarnings.push("Bakım kuralları alınamadı.");
  }
  if (serviceLogsRes.error) {
    coreWarnings.push("Servis kayıtları alınamadı.");
  }
  if (documentCountRes.error) {
    coreWarnings.push("Belge sayısı alınamadı.");
  }
  if (documentsRes.error) {
    coreWarnings.push("Belge listesi alınamadı.");
  }

  const allCoreQueriesFailed =
    !!assetsRes.error &&
    !!rulesRes.error &&
    !!serviceLogsRes.error &&
    !!documentCountRes.error &&
    !!documentsRes.error;

  if (allCoreQueriesFailed) {
    return {
      data: EMPTY_DASHBOARD_DATA,
      isMock: false,
      warning: "Canlı veriler alınamadı. Dashboard sıfır metriklerle gösteriliyor.",
    };
  }

  const optionalWarnings: string[] = [];

  const [
    subscriptionCountRes,
    invoiceCountRes,
    subscriptionsRes,
    paymentRiskRes,
    paidInvoicesRes,
  ] = await Promise.all([
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
    optionalWarnings.push("Abonelik limiti verisi alınamadı.");
  }
  if (invoiceCountRes.error && !isMissingRelationError(invoiceCountRes.error)) {
    optionalWarnings.push("Fatura limiti verisi alınamadı.");
  }
  if (subscriptionsRes.error && !isMissingRelationError(subscriptionsRes.error)) {
    optionalWarnings.push("Abonelik listesi alınamadı.");
  }
  if (paymentRiskRes.error && !isMissingRelationError(paymentRiskRes.error)) {
    optionalWarnings.push("Ödeme riski verisi alınamadı.");
  }
  if (paidInvoicesRes.error && !isMissingRelationError(paidInvoicesRes.error)) {
    optionalWarnings.push("Ödeme aktivitesi alınamadı.");
  }

  const assets = assetsRes.error ? [] : ((assetsRes.data ?? []) as DashboardAssetRow[]);
  const rules = rulesRes.error ? [] : ((rulesRes.data ?? []) as DashboardRuleRow[]);
  const serviceLogs = serviceLogsRes.error ? [] : ((serviceLogsRes.data ?? []) as DashboardServiceLogRow[]);
  const documents = documentsRes.error ? [] : ((documentsRes.data ?? []) as DashboardDocumentRow[]);
  const subscriptions = (subscriptionsRes.data ?? []) as DashboardSubscriptionRow[];
  const paymentRiskInvoices = (paymentRiskRes.data ?? []) as DashboardInvoiceRow[];
  const paidInvoices = (paidInvoicesRes.data ?? []) as DashboardInvoiceRow[];

  const documentCount = documentCountRes.error ? documents.length : (documentCountRes.count ?? documents.length);
  const subscriptionCount = subscriptionCountRes.count ?? 0;
  const invoiceCount = invoiceCountRes.count ?? 0;

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const subscriptionNameById = new Map(
    subscriptions.map((subscription) => [
      subscription.id,
      `${subscription.provider_name} - ${subscription.subscription_name}`,
    ]),
  );

  const maintenanceRisk = toMaintenanceRisk(rules, assetsById, today);
  const warrantyRisk = toWarrantyRisk(assets, today);
  const paymentRisk = toPaymentRisk(paymentRiskInvoices, subscriptionNameById, today);
  const missingDocuments = documentsRes.error ? [] : toMissingDocuments(assets, documents, today);

  const currentAssetsCreated = countInRange(assets, (asset) => parseDate(asset.created_at), currentPeriodStart, tomorrow);
  const previousAssetsCreated = countInRange(
    assets,
    (asset) => parseDate(asset.created_at),
    previousPeriodStart,
    currentPeriodStart,
  );

  const currentRulesCreated = countInRange(rules, (rule) => parseDate(rule.created_at), currentPeriodStart, tomorrow);
  const previousRulesCreated = countInRange(
    rules,
    (rule) => parseDate(rule.created_at),
    previousPeriodStart,
    currentPeriodStart,
  );

  const currentServiceCost = sumInRange(
    serviceLogs,
    (log) => parseDate(log.service_date),
    (log) => Number(log.cost ?? 0),
    currentPeriodStart,
    tomorrow,
  );
  const previousServiceCost = sumInRange(
    serviceLogs,
    (log) => parseDate(log.service_date),
    (log) => Number(log.cost ?? 0),
    previousPeriodStart,
    currentPeriodStart,
  );

  const currentDocumentsUploaded = countInRange(
    documents,
    (document) => parseDate(document.uploaded_at),
    currentPeriodStart,
    tomorrow,
  );
  const previousDocumentsUploaded = countInRange(
    documents,
    (document) => parseDate(document.uploaded_at),
    previousPeriodStart,
    currentPeriodStart,
  );

  const totalServiceCost = serviceLogs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  const overduePaymentCount = paymentRisk.filter((item) => item.daysRemaining < 0).length;
  const upcomingPaymentCount = paymentRisk.filter((item) => item.daysRemaining >= 0).length;
  const warningCount =
    maintenanceRisk.upcomingMaintenance.length +
    warrantyRisk.length +
    upcomingPaymentCount +
    missingDocuments.length;

  const hasData = assets.length > 0 || rules.length > 0 || documentCount > 0 || serviceLogs.length > 0;

  const warningParts = [...coreWarnings, ...optionalWarnings];
  const warning = warningParts.length > 0 ? warningParts.join(" ") : null;

  return {
    data: {
      metrics: {
        totalAssets: assets.length,
        activeRules: rules.length,
        totalServiceCost,
        documentCount,
        subscriptionCount,
        invoiceCount,
      },
      trends: {
        totalAssets: buildTrend(currentAssetsCreated, previousAssetsCreated),
        activeRules: buildTrend(currentRulesCreated, previousRulesCreated),
        totalServiceCost: buildTrend(currentServiceCost, previousServiceCost),
        documentCount: buildTrend(currentDocumentsUploaded, previousDocumentsUploaded),
      },
      status: toSystemStatus({
        hasData,
        assetCount: assets.length,
        activeRuleCount: rules.length,
        overdueMaintenanceCount: maintenanceRisk.overdueMaintenance.length,
        overduePaymentCount,
        upcomingPaymentCount,
        missingDocumentCount: missingDocuments.length,
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


