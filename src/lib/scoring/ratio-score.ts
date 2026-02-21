const DEFAULT_ASSET_VALUE = 10_000;

const PURCHASE_HINTS = ["satin alma", "satın alma", "purchase", "urun", "ürün", "cihaz", "fiyat", "bedel"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toPositiveNumber = (value: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const hasPurchaseHint = (category: string | null | undefined, note: string | null | undefined) => {
  const normalized = `${category ?? ""} ${note ?? ""}`.toLocaleLowerCase("tr-TR");
  return PURCHASE_HINTS.some((hint) => normalized.includes(hint));
};

const ratioToBaseScore = (ratio: number) => {
  // Örnek 1: assetPrice=10_000, totalCost=2_000 => ratio=5 => 80 puan
  // Örnek 2: assetPrice=10_000, totalCost=12_000 => ratio=0.83 => 20 puan
  const safeRatio = Math.max(0, ratio);
  if (safeRatio <= 1) return 20;
  if (safeRatio <= 2) return 40;
  if (safeRatio <= 4) return 60;
  if (safeRatio <= 8) return 80;
  return 95;
};

const scoreToLabel = (score: number) => {
  if (score >= 80) return "iyi";
  if (score >= 60) return "orta";
  return "risk";
};

const ratioToBand = (ratio: number) => {
  if (ratio <= 1) return "kritik";
  if (ratio <= 2) return "izleme";
  if (ratio <= 4) return "denge";
  if (ratio <= 8) return "iyi";
  return "cok_iyi";
};

type AssetValueSource = "purchase_expense" | "max_expense_proxy" | "portfolio_median" | "default_baseline";

export type RatioScoreAsset = {
  id: string;
  name?: string | null;
};

export type RatioScoreLog = {
  assetId: string;
  cost: number;
};

export type RatioScoreExpense = {
  assetId: string | null;
  amount: number;
  category?: string | null;
  note?: string | null;
};

export type RatioScoreRuleContext = {
  activeRuleCount: number;
  overdueRuleCount: number;
};

export type RatioScoreContribution = {
  key: "ratio" | "overdue";
  label: string;
  points: number;
};

export type RatioScoreAssetBreakdown = {
  assetId: string;
  assetName: string;
  valueSource: AssetValueSource;
  assetPrice: number;
  maintenanceCost: number;
  expenseCost: number;
  totalCost: number;
  ratio: number;
};

export type RatioScoreBreakdown = {
  score: number;
  scoreLabel: "iyi" | "orta" | "risk";
  band: "kritik" | "izleme" | "denge" | "iyi" | "cok_iyi";
  baseScore: number;
  overduePenalty: number;
  totalMaintenanceCost: number;
  totalExpenseCost: number;
  totalCost: number;
  totalAssetPrice: number;
  ratio: number;
  hasNoCost: boolean;
  thresholds: {
    low: number;
    watch: number;
    high: number;
    excellent: number;
  };
  valueCoverage: {
    totalAssets: number;
    derivedFromExpense: number;
    fallbackFromMedian: number;
    fallbackFromDefault: number;
  };
  contributions: RatioScoreContribution[];
  assets: RatioScoreAssetBreakdown[];
};

const buildAssetValueMap = (assets: RatioScoreAsset[], expenses: RatioScoreExpense[]) => {
  const expensesByAsset = new Map<string, RatioScoreExpense[]>();
  for (const expense of expenses) {
    if (!expense.assetId) continue;
    if (toPositiveNumber(expense.amount) <= 0) continue;
    const bucket = expensesByAsset.get(expense.assetId) ?? [];
    bucket.push(expense);
    expensesByAsset.set(expense.assetId, bucket);
  }

  const knownValues: number[] = [];
  const valueMap = new Map<string, { value: number; source: AssetValueSource }>();

  for (const asset of assets) {
    const rows = expensesByAsset.get(asset.id) ?? [];
    const purchaseTagged = rows
      .filter((row) => hasPurchaseHint(row.category, row.note))
      .map((row) => toPositiveNumber(row.amount))
      .filter((amount) => amount > 0);

    if (purchaseTagged.length > 0) {
      const value = Math.max(...purchaseTagged);
      valueMap.set(asset.id, { value, source: "purchase_expense" });
      knownValues.push(value);
      continue;
    }

    const proxyValues = rows.map((row) => toPositiveNumber(row.amount)).filter((amount) => amount > 0);
    if (proxyValues.length > 0) {
      const value = Math.max(...proxyValues);
      valueMap.set(asset.id, { value, source: "max_expense_proxy" });
      knownValues.push(value);
    }
  }

  const sortedKnown = [...knownValues].sort((a, b) => a - b);
  const medianValue =
    sortedKnown.length === 0
      ? 0
      : sortedKnown.length % 2 === 1
        ? sortedKnown[Math.floor(sortedKnown.length / 2)]
        : (sortedKnown[sortedKnown.length / 2 - 1] + sortedKnown[sortedKnown.length / 2]) / 2;

  for (const asset of assets) {
    if (valueMap.has(asset.id)) continue;
    if (medianValue > 0) {
      valueMap.set(asset.id, { value: medianValue, source: "portfolio_median" });
      continue;
    }
    valueMap.set(asset.id, { value: DEFAULT_ASSET_VALUE, source: "default_baseline" });
  }

  return valueMap;
};

export function calculateRatioScore(params: {
  assets: RatioScoreAsset[];
  logs: RatioScoreLog[];
  expenses: RatioScoreExpense[];
  rules?: Partial<RatioScoreRuleContext>;
}): RatioScoreBreakdown {
  const mergedAssetsMap = new Map(params.assets.map((asset) => [asset.id, asset]));
  for (const log of params.logs) {
    if (!mergedAssetsMap.has(log.assetId)) {
      mergedAssetsMap.set(log.assetId, { id: log.assetId, name: null });
    }
  }
  const mergedAssets = [...mergedAssetsMap.values()];

  if (mergedAssets.length === 0) {
    return {
      score: 0,
      scoreLabel: "risk",
      band: "kritik",
      baseScore: 0,
      overduePenalty: 0,
      totalMaintenanceCost: 0,
      totalExpenseCost: 0,
      totalCost: 0,
      totalAssetPrice: 0,
      ratio: 0,
      hasNoCost: true,
      thresholds: { low: 1, watch: 2, high: 4, excellent: 8 },
      valueCoverage: {
        totalAssets: 0,
        derivedFromExpense: 0,
        fallbackFromMedian: 0,
        fallbackFromDefault: 0,
      },
      contributions: [
        { key: "ratio", label: "Fiyat / maliyet oranı", points: 0 },
        { key: "overdue", label: "Maliyet yok kuralı", points: 0 },
      ],
      assets: [],
    };
  }

  const maintenanceCostByAsset = new Map<string, number>();
  for (const log of params.logs) {
    const cost = toPositiveNumber(log.cost);
    maintenanceCostByAsset.set(log.assetId, (maintenanceCostByAsset.get(log.assetId) ?? 0) + cost);
  }

  const expenseCostByAsset = new Map<string, number>();
  let unassignedExpenseCost = 0;
  for (const expense of params.expenses) {
    const amount = toPositiveNumber(expense.amount);
    if (amount <= 0) continue;
    if (!expense.assetId) {
      unassignedExpenseCost += amount;
      continue;
    }
    expenseCostByAsset.set(expense.assetId, (expenseCostByAsset.get(expense.assetId) ?? 0) + amount);
  }

  const scopeAssetIdsRaw = new Set<string>([...maintenanceCostByAsset.keys(), ...expenseCostByAsset.keys()]);
  const scopeAssetIds = scopeAssetIdsRaw.size > 0 ? [...scopeAssetIdsRaw] : mergedAssets.map((asset) => asset.id);
  const assetValues = buildAssetValueMap(mergedAssets, params.expenses);
  const assetNameById = new Map(mergedAssets.map((asset) => [asset.id, asset.name ?? "Varlık"]));

  const assets: RatioScoreAssetBreakdown[] = scopeAssetIds.map((assetId) => {
    const valueMeta = assetValues.get(assetId) ?? { value: DEFAULT_ASSET_VALUE, source: "default_baseline" as const };
    const maintenanceCost = maintenanceCostByAsset.get(assetId) ?? 0;
    const expenseCost = expenseCostByAsset.get(assetId) ?? 0;
    const totalCost = maintenanceCost + expenseCost;
    return {
      assetId,
      assetName: assetNameById.get(assetId) ?? "Varlık",
      valueSource: valueMeta.source,
      assetPrice: valueMeta.value,
      maintenanceCost,
      expenseCost,
      totalCost,
      ratio: totalCost > 0 ? valueMeta.value / totalCost : 0,
    };
  });

  assets.sort((a, b) => b.totalCost - a.totalCost);

  const totalMaintenanceCost = assets.reduce((sum, item) => sum + item.maintenanceCost, 0);
  const totalExpenseCost = assets.reduce((sum, item) => sum + item.expenseCost, 0) + unassignedExpenseCost;
  const totalCost = totalMaintenanceCost + totalExpenseCost;
  const totalAssetPrice = assets.reduce((sum, item) => sum + item.assetPrice, 0);
  const hasNoCost = totalCost <= 0;
  const ratio = hasNoCost ? 0 : totalAssetPrice / totalCost;

  // Örnek 3: totalCost=0 ise bölme hatası yok, skor doğrudan 100.
  const baseScore = hasNoCost ? 100 : clamp(ratioToBaseScore(ratio), 0, 100);
  const overduePenalty = 0;
  const score = baseScore;

  const sourceCounters = assets.reduce(
    (acc, item) => {
      if (item.valueSource === "purchase_expense" || item.valueSource === "max_expense_proxy") {
        acc.derivedFromExpense += 1;
      } else if (item.valueSource === "portfolio_median") {
        acc.fallbackFromMedian += 1;
      } else {
        acc.fallbackFromDefault += 1;
      }
      return acc;
    },
    { derivedFromExpense: 0, fallbackFromMedian: 0, fallbackFromDefault: 0 },
  );

  return {
    score,
    scoreLabel: scoreToLabel(score),
    band: hasNoCost ? "cok_iyi" : ratioToBand(ratio),
    baseScore,
    overduePenalty,
    totalMaintenanceCost,
    totalExpenseCost,
    totalCost,
    totalAssetPrice,
    ratio,
    hasNoCost,
    thresholds: { low: 1, watch: 2, high: 4, excellent: 8 },
    valueCoverage: {
      totalAssets: assets.length,
      derivedFromExpense: sourceCounters.derivedFromExpense,
      fallbackFromMedian: sourceCounters.fallbackFromMedian,
      fallbackFromDefault: sourceCounters.fallbackFromDefault,
    },
    contributions: [
      { key: "ratio", label: "Fiyat / maliyet oranı", points: baseScore },
      { key: "overdue", label: hasNoCost ? "Maliyet yok kuralı" : "Ek ceza uygulanmadı", points: hasNoCost ? 100 : 0 },
    ],
    assets,
  };
}
