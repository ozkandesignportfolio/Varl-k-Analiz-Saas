const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toPositiveNumber = (value: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const ratioToBaseScore = (ratio: number) => {
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

type AssetValueSource = "asset_purchase_price" | "missing_purchase_price";

export type RatioScoreAsset = {
  id: string;
  name?: string | null;
  purchasePrice?: number | null;
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
  isApplicable: boolean;
  hasInsufficientData: boolean;
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
    assetsWithCost: number;
    directlyValuedAssets: number;
    missingDirectValueAssets: number;
    coveredCost: number;
    uncoveredCost: number;
    unassignedExpenseCost: number;
    costCoverageRatio: number;
  };
  contributions: RatioScoreContribution[];
  assets: RatioScoreAssetBreakdown[];
};

const buildAssetValueMap = (assets: RatioScoreAsset[]) => {
  const valueMap = new Map<string, { value: number; source: AssetValueSource }>();

  for (const asset of assets) {
    const directPurchasePrice = toPositiveNumber(asset.purchasePrice ?? 0);
    if (directPurchasePrice > 0) {
      valueMap.set(asset.id, { value: directPurchasePrice, source: "asset_purchase_price" });
    }
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
      isApplicable: false,
      hasInsufficientData: false,
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
        assetsWithCost: 0,
        directlyValuedAssets: 0,
        missingDirectValueAssets: 0,
        coveredCost: 0,
        uncoveredCost: 0,
        unassignedExpenseCost: 0,
        costCoverageRatio: 0,
      },
      contributions: [
        { key: "ratio", label: "Gercek deger / maliyet orani", points: 0 },
        { key: "overdue", label: "Veri kapsami", points: 0 },
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
  const assetValues = buildAssetValueMap(mergedAssets);
  const assetNameById = new Map(mergedAssets.map((asset) => [asset.id, asset.name ?? "Varlik"]));

  const assets: RatioScoreAssetBreakdown[] = scopeAssetIds.map((assetId) => {
    const valueMeta = assetValues.get(assetId) ?? { value: 0, source: "missing_purchase_price" as const };
    const maintenanceCost = maintenanceCostByAsset.get(assetId) ?? 0;
    const expenseCost = expenseCostByAsset.get(assetId) ?? 0;
    const totalCost = maintenanceCost + expenseCost;
    return {
      assetId,
      assetName: assetNameById.get(assetId) ?? "Varlik",
      valueSource: valueMeta.source,
      assetPrice: valueMeta.value,
      maintenanceCost,
      expenseCost,
      totalCost,
      ratio: totalCost > 0 && valueMeta.value > 0 ? valueMeta.value / totalCost : 0,
    };
  });

  assets.sort((a, b) => b.totalCost - a.totalCost);

  const totalMaintenanceCost = assets.reduce((sum, item) => sum + item.maintenanceCost, 0);
  const totalExpenseCost = assets.reduce((sum, item) => sum + item.expenseCost, 0) + unassignedExpenseCost;
  const totalCost = totalMaintenanceCost + totalExpenseCost;
  const directlyValuedAssets = assets.filter((item) => item.valueSource === "asset_purchase_price");
  const assetsWithCost = assets.filter((item) => item.totalCost > 0);
  const coveredCost = directlyValuedAssets.reduce((sum, item) => sum + item.totalCost, 0);
  const uncoveredAssetCost = assets
    .filter((item) => item.valueSource === "missing_purchase_price")
    .reduce((sum, item) => sum + item.totalCost, 0);
  const uncoveredCost = uncoveredAssetCost + unassignedExpenseCost;
  const totalAssetPrice = directlyValuedAssets.reduce((sum, item) => sum + item.assetPrice, 0);
  const hasNoCost = totalCost <= 0;
  const hasInsufficientData = !hasNoCost && coveredCost <= 0;
  const ratio = coveredCost > 0 ? totalAssetPrice / coveredCost : 0;
  const costCoverageRatio = totalCost > 0 ? coveredCost / totalCost : 0;

  // Gercek oran yalnizca dogrudan satin alma bedeli olan maliyet kapsamindan hesaplanir.
  const baseScore = hasNoCost || coveredCost <= 0 ? 0 : clamp(ratioToBaseScore(ratio), 0, 100);
  const overduePenalty = 0;
  const score = hasNoCost || coveredCost <= 0 ? 0 : clamp(Math.round(baseScore * costCoverageRatio), 0, 100);

  return {
    score,
    scoreLabel: scoreToLabel(score),
    band: hasNoCost || coveredCost <= 0 ? "kritik" : ratioToBand(ratio),
    baseScore,
    isApplicable: !hasNoCost && coveredCost > 0,
    hasInsufficientData,
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
      assetsWithCost: assetsWithCost.length,
      directlyValuedAssets: directlyValuedAssets.length,
      missingDirectValueAssets: Math.max(0, assets.length - directlyValuedAssets.length),
      coveredCost,
      uncoveredCost,
      unassignedExpenseCost,
      costCoverageRatio,
    },
    contributions: [
      { key: "ratio", label: "Gercek deger / maliyet orani", points: baseScore },
      { key: "overdue", label: "Veri kapsami", points: Math.round(costCoverageRatio * 100) },
    ],
    assets,
  };
}
