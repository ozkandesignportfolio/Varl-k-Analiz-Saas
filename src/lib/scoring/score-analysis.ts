import { calculateRatioScore, type RatioScoreBreakdown } from "@/lib/scoring/ratio-score";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const roundScore = (value: number) => clamp(Math.round(value), 0, 100);

const scoreToLabel = (score: number): "iyi" | "orta" | "risk" => {
  if (score >= 80) return "iyi";
  if (score >= 60) return "orta";
  return "risk";
};

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
};

const divide = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : 0);

export type ScoreAnalysisAsset = {
  id: string;
  name?: string | null;
  purchasePrice?: number | null;
  warrantyEndDate?: string | null;
};

export type ScoreAnalysisMaintenanceRule = {
  id: string;
  assetId: string;
  isActive: boolean;
  nextDueDate: string | null;
  lastServiceDate?: string | null;
};

export type ScoreAnalysisServiceLog = {
  assetId: string;
  cost: number;
};

export type ScoreAnalysisDocument = {
  assetId: string;
};

export type ScoreAnalysisExpense = {
  assetId: string | null;
  amount: number;
  category?: string | null;
  note?: string | null;
};

export type ScoreAnalysisSubscription = {
  id: string;
  status: "active" | "paused" | "cancelled";
  nextBillingDate?: string | null;
};

export type ScoreAnalysisInvoice = {
  id: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  dueDate?: string | null;
};

export type ScoreAnalysisSectionKey =
  | "asset-data"
  | "maintenance"
  | "warranty"
  | "documents"
  | "cost"
  | "billing";

export type ScoreAnalysisSection = {
  key: ScoreAnalysisSectionKey;
  label: string;
  score: number;
  applicable: boolean;
  weight: number;
  summary: string;
};

export type ScoreAnalysisSuggestion = {
  key: string;
  text: string;
  priority: number;
};

export type ScoreAnalysisResult = {
  overallScore: number;
  scoreLabel: "iyi" | "orta" | "risk";
  sections: ScoreAnalysisSection[];
  suggestions: ScoreAnalysisSuggestion[];
  emptyState: {
    title: string;
    description: string;
  } | null;
  assetMetrics: {
    total: number;
    withPurchasePrice: number;
    missingPurchasePrice: number;
    withWarrantyDate: number;
    missingWarrantyDate: number;
  };
  warrantyMetrics: {
    active: number;
    expiring: number;
    expired: number;
    unknown: number;
  };
  maintenanceMetrics: {
    activeRules: number;
    assetsWithActiveRule: number;
    completedRules: number;
    onTrackRules: number;
    overdueRules: number;
  };
  documentMetrics: {
    totalDocuments: number;
    documentedAssets: number;
    missingAssets: number;
  };
  billingMetrics: {
    subscriptions: number;
    activeSubscriptions: number;
    pausedSubscriptions: number;
    cancelledSubscriptions: number;
    invoices: number;
    paidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
  };
  costBreakdown: RatioScoreBreakdown;
};

export function calculateScoreAnalysis(params: {
  assets: ScoreAnalysisAsset[];
  maintenanceRules: ScoreAnalysisMaintenanceRule[];
  serviceLogs: ScoreAnalysisServiceLog[];
  documents: ScoreAnalysisDocument[];
  expenses: ScoreAnalysisExpense[];
  subscriptions: ScoreAnalysisSubscription[];
  invoices: ScoreAnalysisInvoice[];
  now?: Date;
}): ScoreAnalysisResult {
  const now = params.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(today.getDate() + 30);

  const assetCount = params.assets.length;
  const assetIdSet = new Set(params.assets.map((asset) => asset.id));
  const assetsWithPurchasePrice = params.assets.filter((asset) => Number(asset.purchasePrice ?? 0) > 0).length;
  const assetsWithWarrantyDate = params.assets.filter((asset) => Boolean(parseDateOnly(asset.warrantyEndDate))).length;

  let activeWarrantyCount = 0;
  let expiringWarrantyCount = 0;
  let expiredWarrantyCount = 0;
  let unknownWarrantyCount = 0;

  for (const asset of params.assets) {
    const warrantyEndDate = parseDateOnly(asset.warrantyEndDate);
    if (!warrantyEndDate) {
      unknownWarrantyCount += 1;
      continue;
    }

    if (warrantyEndDate < today) {
      expiredWarrantyCount += 1;
    } else if (warrantyEndDate <= inThirtyDays) {
      expiringWarrantyCount += 1;
    } else {
      activeWarrantyCount += 1;
    }
  }

  const serviceLogAssetIds = new Set(params.serviceLogs.map((log) => log.assetId));
  const activeRules = params.maintenanceRules.filter((rule) => rule.isActive);
  const assetsWithActiveRule = new Set(
    activeRules.map((rule) => rule.assetId).filter((assetId) => assetIdSet.has(assetId)),
  ).size;
  const completedRules = activeRules.filter(
    (rule) => Boolean(parseDateOnly(rule.lastServiceDate)) || serviceLogAssetIds.has(rule.assetId),
  ).length;
  const onTrackRules = activeRules.filter((rule) => {
    const nextDueDate = parseDateOnly(rule.nextDueDate);
    return nextDueDate ? nextDueDate >= today : false;
  }).length;
  const overdueRules = activeRules.filter((rule) => {
    const nextDueDate = parseDateOnly(rule.nextDueDate);
    return nextDueDate ? nextDueDate < today : false;
  }).length;

  const documentedAssetIds = new Set(
    params.documents.map((document) => document.assetId).filter((assetId) => assetIdSet.has(assetId)),
  );
  const documentedAssets = documentedAssetIds.size;
  const missingDocumentAssets = Math.max(0, assetCount - documentedAssets);

  const activeSubscriptions = params.subscriptions.filter((subscription) => subscription.status === "active").length;
  const pausedSubscriptions = params.subscriptions.filter((subscription) => subscription.status === "paused").length;
  const cancelledSubscriptions = params.subscriptions.filter((subscription) => subscription.status === "cancelled").length;
  const paidInvoices = params.invoices.filter((invoice) => invoice.status === "paid").length;
  const pendingInvoices = params.invoices.filter((invoice) => invoice.status === "pending").length;
  const overdueInvoices = params.invoices.filter((invoice) => invoice.status === "overdue").length;

  const costBreakdown = calculateRatioScore({
    assets: params.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      purchasePrice: Number(asset.purchasePrice ?? 0),
    })),
    logs: params.serviceLogs.map((log) => ({
      assetId: log.assetId,
      cost: Number(log.cost ?? 0),
    })),
    expenses: params.expenses.map((expense) => ({
      assetId: expense.assetId,
      amount: Number(expense.amount ?? 0),
      category: expense.category,
      note: expense.note,
    })),
  });
  const costCoveragePercent = roundScore(costBreakdown.valueCoverage.costCoverageRatio * 100);
  const roundedCostRatio = Math.round(costBreakdown.ratio * 100) / 100;

  const assetDataScore =
    assetCount > 0
      ? roundScore(
          (divide(assetsWithPurchasePrice, assetCount) * 65 + divide(assetsWithWarrantyDate, assetCount) * 35) * 100,
        )
      : 0;
  const maintenanceScore =
    assetCount > 0 || activeRules.length > 0 || params.serviceLogs.length > 0
      ? roundScore(
          (divide(assetsWithActiveRule, Math.max(assetCount, 1)) * 0.45 +
            divide(onTrackRules, Math.max(activeRules.length, 1)) * 0.35 +
            divide(completedRules, Math.max(activeRules.length, 1)) * 0.2) *
            100,
        )
      : 0;
  const warrantyScore =
    assetCount > 0
      ? roundScore(
          divide(
            activeWarrantyCount * 100 + expiringWarrantyCount * 65 + expiredWarrantyCount * 20 + unknownWarrantyCount * 35,
            assetCount,
          ),
        )
      : 0;
  const documentScore = assetCount > 0 ? roundScore(divide(documentedAssets, assetCount) * 100) : 0;

  const invoiceScore =
    params.invoices.length > 0
      ? divide(paidInvoices * 100 + pendingInvoices * 60 + overdueInvoices * 15, params.invoices.length)
      : null;
  const subscriptionScore =
    params.subscriptions.length > 0
      ? divide(activeSubscriptions * 100 + pausedSubscriptions * 55 + cancelledSubscriptions * 25, params.subscriptions.length)
      : null;
  const billingScore =
    invoiceScore === null && subscriptionScore === null
      ? 0
      : roundScore(
          (invoiceScore === null ? 0 : invoiceScore * 0.7) +
            (subscriptionScore === null ? 0 : subscriptionScore * (invoiceScore === null ? 1 : 0.3)),
        );

  const sections: ScoreAnalysisSection[] = [
    {
      key: "asset-data",
      label: "Varlık Verisi",
      score: assetDataScore,
      applicable: assetCount > 0,
      weight: 0.2,
      summary:
        assetCount > 0
          ? `${assetsWithPurchasePrice}/${assetCount} satın alma bedeli, ${assetsWithWarrantyDate}/${assetCount} garanti tarihi girildi.`
          : "Henüz varlık kaydı yok.",
    },
    {
      key: "maintenance",
      label: "Bakım Hazırlığı",
      score: maintenanceScore,
      applicable: assetCount > 0 || activeRules.length > 0 || params.serviceLogs.length > 0,
      weight: 0.25,
      summary:
        activeRules.length > 0
          ? `${activeRules.length} aktif kuralın ${onTrackRules} tanesi zamanında, ${overdueRules} tanesi gecikmiş.`
          : assetCount > 0
            ? "Aktif bakım kuralı bulunmuyor."
            : "Bakım verisi yok.",
    },
    {
      key: "warranty",
      label: "Garanti",
      score: warrantyScore,
      applicable: assetCount > 0,
      weight: 0.15,
      summary:
        assetCount > 0
          ? `${activeWarrantyCount} aktif, ${expiringWarrantyCount} yakında sona erecek, ${expiredWarrantyCount} süresi dolmuş, ${unknownWarrantyCount} eksik tarih.`
          : "Garanti skoru için varlık verisi bekleniyor.",
    },
    {
      key: "documents",
      label: "Belge Tamamlılığı",
      score: documentScore,
      applicable: assetCount > 0,
      weight: 0.15,
      summary:
        assetCount > 0
          ? `${documentedAssets}/${assetCount} varlık en az bir belgeye sahip.`
          : "Belge skoru için varlık verisi bekleniyor.",
    },
    {
      key: "cost",
      label: "Maliyet / Değer",
      score: costBreakdown.score,
      applicable: costBreakdown.isApplicable,
      weight: 0.15,
      summary: costBreakdown.hasNoCost
        ? assetCount > 0
          ? "Bakım veya harcama kaydı olmadığı için bu boyut genel skora dahil edilmedi."
          : "Maliyet verisi yok."
        : costBreakdown.hasInsufficientData
          ? "Maliyet kaydı var ancak bunları doğrudan satın alma bedeliyle eşleyecek veri yok. Bu boyut genel skora dahil edilmedi."
          : costBreakdown.valueCoverage.costCoverageRatio < 1
            ? `${roundedCostRatio} oranı yalnızca gerçek bedeli olan maliyetlerin %${costCoveragePercent} kısmından hesaplandı; eksik değer verisi nedeniyle skor temkinli düşürüldü.`
            : `${roundedCostRatio} oranı, ${costBreakdown.valueCoverage.directlyValuedAssets}/${costBreakdown.valueCoverage.totalAssets} maliyet kapsamındaki varlıkta doğrudan satın alma bedeline dayanıyor.`,
    },
    {
      key: "billing",
      label: "Fatura Sağlığı",
      score: billingScore,
      applicable: params.subscriptions.length > 0 || params.invoices.length > 0,
      weight: 0.1,
      summary:
        params.invoices.length > 0 || params.subscriptions.length > 0
          ? `${paidInvoices} ödenmiş, ${pendingInvoices} bekleyen, ${overdueInvoices} geciken fatura; ${activeSubscriptions} aktif abonelik.`
          : "Fatura / abonelik kaydı yok.",
    },
  ];

  const applicableSections = sections.filter((section) => section.applicable);
  const totalWeight = applicableSections.reduce((sum, section) => sum + section.weight, 0);
  const overallScore =
    totalWeight > 0
      ? roundScore(applicableSections.reduce((sum, section) => sum + section.score * section.weight, 0) / totalWeight)
      : 0;

  const suggestions: ScoreAnalysisSuggestion[] = [];
  if (assetCount === 0 && params.invoices.length === 0 && params.subscriptions.length === 0 && params.serviceLogs.length === 0) {
    suggestions.push({
      key: "seed-assets",
      text: "Gerçek skor üretmek için en az bir varlık ekleyin ve temel kayıt alanlarını doldurun.",
      priority: 100,
    });
  }
  if (assetCount > 0 && assetsWithPurchasePrice < assetCount) {
    suggestions.push({
      key: "purchase-price",
      text: `${assetCount - assetsWithPurchasePrice} varlıkta satın alma bedeli eksik. Bu alan maliyet/değer skorunun güvenilirliğini artırır.`,
      priority: 90,
    });
  }
  if (assetCount > 0 && assetsWithWarrantyDate < assetCount) {
    suggestions.push({
      key: "warranty-date",
      text: `${assetCount - assetsWithWarrantyDate} varlıkta garanti bitiş tarihi eksik. Eksik tarih garanti riskini gizliyor.`,
      priority: 85,
    });
  }
  if (assetCount > 0 && assetsWithActiveRule < assetCount) {
    suggestions.push({
      key: "maintenance-coverage",
      text: `${assetCount - assetsWithActiveRule} varlık için aktif bakım kuralı yok. Planlı bakım kuralları bakım skorunu toparlar.`,
      priority: 80,
    });
  }
  if (overdueRules > 0) {
    suggestions.push({
      key: "overdue-maintenance",
      text: `${overdueRules} aktif bakım kuralı gecikmiş durumda. Tamamlanan servis kaydı eklemek skoru doğrudan iyileştirir.`,
      priority: 95,
    });
  }
  if (missingDocumentAssets > 0) {
    suggestions.push({
      key: "documents",
      text: `${missingDocumentAssets} varlık hiç belgeye sahip değil. Fatura, garanti veya servis dosyaları belge skorunu yükseltir.`,
      priority: 75,
    });
  }
  if (overdueInvoices > 0) {
    suggestions.push({
      key: "overdue-invoices",
      text: `${overdueInvoices} fatura gecikmiş durumda. Ödeme veya durum güncellemesi fatura sağlığını toparlar.`,
      priority: 88,
    });
  }
  if (pendingInvoices > 0) {
    suggestions.push({
      key: "pending-invoices",
      text: `${pendingInvoices} fatura beklemede. Vadesi yakın olanları takip etmek finansal riski azaltır.`,
      priority: 60,
    });
  }
  if (costBreakdown.isApplicable && costBreakdown.score < 60) {
    suggestions.push({
      key: "cost-ratio",
      text: "Bakım ve harcama maliyeti portföy değerine yaklaşıyor. Satın alma bedeli kapsamını ve maliyet kayıtlarını gözden geçirin.",
      priority: 70,
    });
  }

  suggestions.sort((left, right) => right.priority - left.priority);

  return {
    overallScore,
    scoreLabel: scoreToLabel(overallScore),
    sections,
    suggestions: suggestions.slice(0, 5),
    emptyState:
      applicableSections.length === 0
        ? {
            title: "Henüz güvenilir skor üretecek veri yok",
            description:
              "Bu ekran artık demo değer göstermiyor. Varlık, bakım, belge, harcama veya fatura kaydı geldikçe skor otomatik hesaplanacak.",
          }
        : null,
    assetMetrics: {
      total: assetCount,
      withPurchasePrice: assetsWithPurchasePrice,
      missingPurchasePrice: Math.max(0, assetCount - assetsWithPurchasePrice),
      withWarrantyDate: assetsWithWarrantyDate,
      missingWarrantyDate: Math.max(0, assetCount - assetsWithWarrantyDate),
    },
    warrantyMetrics: {
      active: activeWarrantyCount,
      expiring: expiringWarrantyCount,
      expired: expiredWarrantyCount,
      unknown: unknownWarrantyCount,
    },
    maintenanceMetrics: {
      activeRules: activeRules.length,
      assetsWithActiveRule,
      completedRules,
      onTrackRules,
      overdueRules,
    },
    documentMetrics: {
      totalDocuments: params.documents.length,
      documentedAssets,
      missingAssets: missingDocumentAssets,
    },
    billingMetrics: {
      subscriptions: params.subscriptions.length,
      activeSubscriptions,
      pausedSubscriptions,
      cancelledSubscriptions,
      invoices: params.invoices.length,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
    },
    costBreakdown,
  };
}

