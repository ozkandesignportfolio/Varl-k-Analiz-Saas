import assert from "node:assert/strict";
import test from "node:test";
import {
  mapDashboardSnapshotRpcPayload,
  type DashboardActivityItem,
  type DashboardKpiTrend,
  type DashboardSnapshot,
  type DashboardSystemStatus,
} from "./dashboard-queries";

type SeedAsset = {
  id: string;
  name: string;
  warrantyEndDate: string | null;
  createdAt: string;
};

type SeedRule = {
  id: string;
  assetId: string;
  title: string;
  dueDate: string;
  isActive: boolean;
  createdAt: string;
};

type SeedService = {
  id: string;
  assetId: string;
  serviceType: string;
  createdAt: string;
};

type SeedDocument = {
  id: string;
  assetId: string;
  fileName: string;
  uploadedAt: string;
};

type SeedSubscription = {
  id: string;
  providerName: string;
  subscriptionName: string;
};

type SeedInvoice = {
  id: string;
  subscriptionId: string;
  invoiceNo: string | null;
  dueDate: string | null;
  totalAmount: number;
  status: "pending" | "overdue" | "paid";
  createdAt: string;
  paidAt: string | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string) => new Date(value.includes("T") ? value : `${value}T00:00:00`);
const dayDiff = (date: Date, from: Date) => Math.ceil((date.getTime() - from.getTime()) / DAY_IN_MS);

const createSparkline = (direction: "up" | "down" | "flat") => {
  if (direction === "up") return [22, 24, 28, 30, 34, 37];
  if (direction === "down") return [37, 34, 31, 28, 25, 22];
  return [28, 27, 28, 27, 28, 27];
};

const buildTrend = (current: number, previous: number): DashboardKpiTrend => {
  if (current <= 0 && previous <= 0) {
    return { direction: "flat", percentage: 0, sparkline: createSparkline("flat") };
  }
  if (previous <= 0 && current > 0) {
    return { direction: "up", percentage: 100, sparkline: createSparkline("up") };
  }

  const delta = current - previous;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const percentage = Math.min(999, Math.round((Math.abs(delta) / Math.abs(previous || 1)) * 100));
  return { direction, percentage, sparkline: createSparkline(direction) };
};

const toSystemStatus = (args: {
  hasData: boolean;
  assetCount: number;
  activeRuleCount: number;
  overdueMaintenanceCount: number;
  overduePaymentCount: number;
  upcomingPaymentCount: number;
  missingDocumentCount: number;
  warningCount: number;
}): DashboardSystemStatus => {
  if (!args.hasData) {
    return {
      tone: "stable",
      headline: "Stabil",
      detail: "Sistem durumu veri geldikce otomatik guncellenecek.",
      riskCount: 0,
      risk: { type: "notification_prefs", entityId: null, riskKey: "notification_prefs:global" },
    };
  }

  if (args.overdueMaintenanceCount > 0) {
    return {
      tone: "critical",
      headline: `${args.overdueMaintenanceCount} gecikmis bakim`,
      detail: "Bakim takvimi plani gerisinde. Hemen aksiyon alin.",
      riskCount: args.overdueMaintenanceCount + args.overduePaymentCount + args.warningCount,
      risk: { type: "maintenance_due", entityId: null, riskKey: "maintenance_due:global" },
    };
  }

  if (args.overduePaymentCount > 0) {
    return {
      tone: "critical",
      headline: `${args.overduePaymentCount} gecikmis odeme`,
      detail: "Finans kayitlari gecikmede. Vade durumunu kontrol edin.",
      riskCount: args.overduePaymentCount + args.warningCount,
      risk: { type: "invoice_due", entityId: null, riskKey: "invoice_due:global" },
    };
  }

  if (args.assetCount > 0 && args.activeRuleCount === 0) {
    return {
      tone: "warning",
      headline: "Bakim kurali eksik",
      detail: "Varliklar icin en az bir bakim kurali tanimlayarak riski azaltin.",
      riskCount: Math.max(1, args.warningCount),
      risk: { type: "rule_missing", entityId: null, riskKey: "rule_missing:global" },
    };
  }

  if (args.warningCount > 0) {
    if (args.missingDocumentCount > 0) {
      return {
        tone: "warning",
        headline: `${args.warningCount} risk var`,
        detail: "Yaklaşan takvimler için önleyici adım alınması önerilir.",
        riskCount: args.warningCount,
        risk: { type: "document_missing", entityId: null, riskKey: "document_missing:global" },
      };
    }
    if (args.upcomingPaymentCount > 0) {
      return {
        tone: "warning",
        headline: `${args.warningCount} risk var`,
        detail: "Yaklaşan takvimler için önleyici adım alınması önerilir.",
        riskCount: args.warningCount,
        risk: { type: "invoice_due", entityId: null, riskKey: "invoice_due:global" },
      };
    }
    return {
      tone: "warning",
      headline: `${args.warningCount} risk var`,
      detail: "Yaklaşan takvimler için önleyici adım alınması önerilir.",
      riskCount: args.warningCount,
      risk: { type: "maintenance_due", entityId: null, riskKey: "maintenance_due:global" },
    };
  }

  return {
    tone: "healthy",
    headline: "Her şey yolunda",
    detail: "Kritik veya yaklaşan risk kaydı şu an bulunmuyor.",
    riskCount: 0,
    risk: { type: "notification_prefs", entityId: null, riskKey: "notification_prefs:global" },
  };
};

const seed = {
  today: new Date("2026-02-10T00:00:00.000Z"),
  assets: [
    { id: "asset-1", name: "Generator", warrantyEndDate: "2026-02-16", createdAt: "2026-01-01T09:00:00.000Z" },
    { id: "asset-2", name: "Pump", warrantyEndDate: null, createdAt: "2026-01-20T09:00:00.000Z" },
  ] satisfies SeedAsset[],
  rules: [
    {
      id: "rule-1",
      assetId: "asset-1",
      title: "Oil change",
      dueDate: "2026-02-08",
      isActive: true,
      createdAt: "2026-01-15T10:00:00.000Z",
    },
    {
      id: "rule-2",
      assetId: "asset-2",
      title: "Pressure check",
      dueDate: "2026-02-13",
      isActive: true,
      createdAt: "2026-02-01T10:00:00.000Z",
    },
  ] satisfies SeedRule[],
  services: [
    { id: "svc-1", assetId: "asset-1", serviceType: "Oil", createdAt: "2026-02-09T10:00:00.000Z" },
    { id: "svc-2", assetId: "asset-2", serviceType: "Inspection", createdAt: "2026-02-05T10:00:00.000Z" },
  ] satisfies SeedService[],
  documents: [
    { id: "doc-1", assetId: "asset-1", fileName: "invoice.pdf", uploadedAt: "2026-02-09T12:00:00.000Z" },
  ] satisfies SeedDocument[],
  subscriptions: [{ id: "sub-1", providerName: "Cloud", subscriptionName: "Premium" }] satisfies SeedSubscription[],
  invoices: [
    {
      id: "inv-1",
      subscriptionId: "sub-1",
      invoiceNo: "F-100",
      dueDate: "2026-02-12",
      totalAmount: 200,
      status: "pending",
      createdAt: "2026-02-02T10:00:00.000Z",
      paidAt: null,
    },
    {
      id: "inv-2",
      subscriptionId: "sub-1",
      invoiceNo: "F-101",
      dueDate: "2026-02-09",
      totalAmount: 300,
      status: "overdue",
      createdAt: "2026-02-01T10:00:00.000Z",
      paidAt: null,
    },
    {
      id: "inv-3",
      subscriptionId: "sub-1",
      invoiceNo: "F-102",
      dueDate: "2026-02-05",
      totalAmount: 250,
      status: "paid",
      createdAt: "2026-02-03T10:00:00.000Z",
      paidAt: "2026-02-09",
    },
  ] satisfies SeedInvoice[],
  aggregate: {
    totalAssets: 2,
    activeRules: 2,
    documentCount: 1,
    documentedAssetCount: 1,
    subscriptionCount: 1,
    invoiceCount: 3,
    totalServiceCost: 150,
    documentsTotalSize: 1024,
    invoicesTotalAmount: 750,
    currentAssetsCreated: 1,
    previousAssetsCreated: 1,
    currentRulesCreated: 1,
    previousRulesCreated: 1,
    currentServiceCost: 100,
    previousServiceCost: 50,
    currentDocumentsUploaded: 1,
    previousDocumentsUploaded: 0,
  },
};

const buildLegacySnapshot = (): DashboardSnapshot => {
  const assetsById = new Map(seed.assets.map((asset) => [asset.id, asset]));
  const subscriptionNameById = new Map(
    seed.subscriptions.map((subscription) => [subscription.id, `${subscription.providerName} - ${subscription.subscriptionName}`]),
  );

  const overdueMaintenance = seed.rules
    .filter((rule) => rule.isActive)
    .map((rule) => {
      const asset = assetsById.get(rule.assetId);
      if (!asset) return null;
      const dueInDays = dayDiff(parseDate(rule.dueDate), seed.today);
      if (dueInDays >= 0) return null;
      return {
        id: rule.id,
        assetId: rule.assetId,
        assetName: asset.name,
        ruleTitle: rule.title,
        dueDate: rule.dueDate,
        dayCount: Math.abs(dueInDays),
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((a, b) => b.dayCount - a.dayCount)
    .slice(0, 10);

  const upcomingMaintenance = seed.rules
    .filter((rule) => rule.isActive)
    .map((rule) => {
      const asset = assetsById.get(rule.assetId);
      if (!asset) return null;
      const dueInDays = dayDiff(parseDate(rule.dueDate), seed.today);
      if (dueInDays < 0 || dueInDays > 7) return null;
      return {
        id: rule.id,
        assetId: rule.assetId,
        assetName: asset.name,
        ruleTitle: rule.title,
        dueDate: rule.dueDate,
        dayCount: dueInDays,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
    .sort((a, b) => a.dayCount - b.dayCount)
    .slice(0, 10);

  const upcomingWarranty = seed.assets
    .filter((asset) => !!asset.warrantyEndDate)
    .map((asset) => {
      const warrantyEndDate = asset.warrantyEndDate as string;
      return {
        id: asset.id,
        assetId: asset.id,
        assetName: asset.name,
        warrantyEndDate,
        daysRemaining: dayDiff(parseDate(warrantyEndDate), seed.today),
      };
    })
    .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10);

  const upcomingPayments = seed.invoices
    .filter((invoice) => !!invoice.dueDate && (invoice.status === "pending" || invoice.status === "overdue"))
    .map((invoice) => {
      const dueDate = invoice.dueDate as string;
      return {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        subscriptionName: subscriptionNameById.get(invoice.subscriptionId) ?? "Abonelik",
        dueDate,
        totalAmount: invoice.totalAmount,
        status: invoice.status as "pending" | "overdue",
        daysRemaining: dayDiff(parseDate(dueDate), seed.today),
      };
    })
    .filter((item) => item.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10);

  const documentedAssetIds = new Set(seed.documents.map((document) => document.assetId));
  const missingDocuments = seed.assets
    .filter((asset) => !documentedAssetIds.has(asset.id))
    .slice(0, 10)
    .map((asset) => ({
      id: asset.id,
      assetId: asset.id,
      assetName: asset.name,
      createdAt: asset.createdAt,
      daysWithoutDocument: Math.max(
        0,
        Math.floor((seed.today.getTime() - parseDate(asset.createdAt).getTime()) / DAY_IN_MS),
      ),
    }));

  const recentActivity: DashboardActivityItem[] = [
    ...seed.services.map((service) => ({
      id: `service-${service.id}`,
      type: "service" as const,
      title: "Servis kaydı eklendi",
      description: `${assetsById.get(service.assetId)?.name ?? "Bilinmeyen Varlık"} - ${service.serviceType}`,
      date: service.createdAt,
      href: `/services?asset=${service.assetId}`,
    })),
    ...seed.documents.map((document) => ({
      id: `document-${document.id}`,
      type: "document" as const,
      title: "Belge yüklendi",
      description: `${assetsById.get(document.assetId)?.name ?? "Bilinmeyen Varlık"} - ${document.fileName}`,
      date: document.uploadedAt,
      href: `/documents?asset=${document.assetId}`,
    })),
    ...seed.rules.map((rule) => ({
      id: `rule-${rule.id}`,
      type: "rule" as const,
      title: "Bakım kuralı oluşturuldu",
      description: `${assetsById.get(rule.assetId)?.name ?? "Bilinmeyen Varlık"} - ${rule.title}`,
      date: rule.createdAt,
      href: `/maintenance?asset=${rule.assetId}`,
    })),
    ...seed.invoices
      .filter((invoice) => invoice.status === "paid" && invoice.paidAt)
      .map((invoice) => ({
        id: `payment-${invoice.id}`,
        type: "payment" as const,
        title: "Ödeme işlendi",
        description: `${subscriptionNameById.get(invoice.subscriptionId) ?? "Abonelik"} - ${invoice.totalAmount.toFixed(2)} TL`,
        date: invoice.paidAt as string,
        href: "/invoices",
      })),
  ]
    .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
    .slice(0, 20);

  const overduePaymentCount = upcomingPayments.filter((item) => item.daysRemaining < 0).length;
  const upcomingPaymentCount = upcomingPayments.filter((item) => item.daysRemaining >= 0).length;
  const missingDocumentCount = Math.max(0, seed.aggregate.totalAssets - seed.aggregate.documentedAssetCount);
  const warningCount =
    upcomingMaintenance.length + upcomingWarranty.length + upcomingPaymentCount + missingDocuments.length;

  return {
    metrics: {
      totalAssets: seed.aggregate.totalAssets,
      activeRules: seed.aggregate.activeRules,
      totalServiceCost: seed.aggregate.totalServiceCost,
      documentCount: seed.aggregate.documentCount,
      subscriptionCount: seed.aggregate.subscriptionCount,
      invoiceCount: seed.aggregate.invoiceCount,
      documentsTotalSize: seed.aggregate.documentsTotalSize,
      invoicesTotalAmount: seed.aggregate.invoicesTotalAmount,
    },
    trends: {
      totalAssets: buildTrend(seed.aggregate.currentAssetsCreated, seed.aggregate.previousAssetsCreated),
      activeRules: buildTrend(seed.aggregate.currentRulesCreated, seed.aggregate.previousRulesCreated),
      totalServiceCost: buildTrend(seed.aggregate.currentServiceCost, seed.aggregate.previousServiceCost),
      documentCount: buildTrend(seed.aggregate.currentDocumentsUploaded, seed.aggregate.previousDocumentsUploaded),
    },
    status: toSystemStatus({
      hasData:
        seed.aggregate.totalAssets > 0 ||
        seed.aggregate.activeRules > 0 ||
        seed.aggregate.documentCount > 0 ||
        seed.aggregate.totalServiceCost > 0,
      assetCount: seed.aggregate.totalAssets,
      activeRuleCount: seed.aggregate.activeRules,
      overdueMaintenanceCount: overdueMaintenance.length,
      overduePaymentCount,
      upcomingPaymentCount,
      missingDocumentCount,
      warningCount,
    }),
    riskPanel: {
      overdueMaintenance,
      upcomingMaintenance,
      upcomingWarranty,
      upcomingPayments,
      missingDocuments,
    },
    recentActivity,
  };
};

const toRpcPayload = (snapshot: DashboardSnapshot) => ({
  counts: {
    assets_count: String(snapshot.metrics.totalAssets),
    documents_count: String(snapshot.metrics.documentCount),
    subscriptions_count: String(snapshot.metrics.subscriptionCount),
    invoices_count: String(snapshot.metrics.invoiceCount),
  },
  sums: {
    total_cost: String(snapshot.metrics.totalServiceCost),
    documents_total_size: String(snapshot.metrics.documentsTotalSize),
    invoices_total_amount: String(snapshot.metrics.invoicesTotalAmount),
  },
  metrics: {
    total_assets: String(snapshot.metrics.totalAssets),
    active_rules: String(snapshot.metrics.activeRules),
    total_service_cost: String(snapshot.metrics.totalServiceCost),
    document_count: String(snapshot.metrics.documentCount),
    subscription_count: String(snapshot.metrics.subscriptionCount),
    invoice_count: String(snapshot.metrics.invoiceCount),
  },
  trends: {
    total_assets: snapshot.trends.totalAssets,
    active_rules: snapshot.trends.activeRules,
    total_service_cost: snapshot.trends.totalServiceCost,
    document_count: snapshot.trends.documentCount,
  },
  status: {
    tone: snapshot.status.tone,
    headline: snapshot.status.headline,
    detail: snapshot.status.detail,
    risk_count: String(snapshot.status.riskCount),
    risk: {
      type: snapshot.status.risk.type,
      entity_id: snapshot.status.risk.entityId,
      risk_key: snapshot.status.risk.riskKey,
    },
  },
  risk_panel: {
    overdue_maintenance: snapshot.riskPanel.overdueMaintenance.map((item) => ({
      id: item.id,
      asset_id: item.assetId,
      asset_name: item.assetName,
      rule_title: item.ruleTitle,
      due_date: item.dueDate,
      day_count: String(item.dayCount),
    })),
    upcoming_maintenance: snapshot.riskPanel.upcomingMaintenance.map((item) => ({
      id: item.id,
      asset_id: item.assetId,
      asset_name: item.assetName,
      rule_title: item.ruleTitle,
      due_date: item.dueDate,
      day_count: String(item.dayCount),
    })),
    upcoming_warranty: snapshot.riskPanel.upcomingWarranty.map((item) => ({
      id: item.id,
      asset_id: item.assetId,
      asset_name: item.assetName,
      warranty_end_date: item.warrantyEndDate,
      days_remaining: String(item.daysRemaining),
    })),
    upcoming_payments: snapshot.riskPanel.upcomingPayments.map((item) => ({
      id: item.id,
      invoice_no: item.invoiceNo,
      subscription_name: item.subscriptionName,
      due_date: item.dueDate,
      total_amount: String(item.totalAmount),
      status: item.status,
      days_remaining: String(item.daysRemaining),
    })),
    missing_documents: snapshot.riskPanel.missingDocuments.map((item) => ({
      id: item.id,
      asset_id: item.assetId,
      asset_name: item.assetName,
      created_at: item.createdAt,
      days_without_document: String(item.daysWithoutDocument),
    })),
  },
  timeline: snapshot.recentActivity,
});

test("dashboard snapshot mapper keeps parity with legacy JS snapshot semantics on seeded data", () => {
  const legacySnapshot = buildLegacySnapshot();
  const rpcPayload = toRpcPayload(legacySnapshot);
  const mapped = mapDashboardSnapshotRpcPayload(rpcPayload);

  assert.deepEqual(mapped, legacySnapshot);
});
