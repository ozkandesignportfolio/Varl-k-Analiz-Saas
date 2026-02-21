const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type HealthScoreInput = {
  assetPrice: number;
  totalCost: number;
};

export type HealthScoreResult = {
  score: number;
  ratio: number;
  hasNoCost: boolean;
};

export const computeHealthScore = ({ assetPrice, totalCost }: HealthScoreInput): HealthScoreResult => {
  const normalizedAssetPrice = Number.isFinite(assetPrice) ? Math.max(0, assetPrice) : 0;
  const normalizedTotalCost = Number.isFinite(totalCost) ? Math.max(0, totalCost) : 0;

  if (normalizedTotalCost <= 0) {
    return {
      score: 100,
      ratio: 0,
      hasNoCost: true,
    };
  }

  const ratio = normalizedAssetPrice / normalizedTotalCost;

  if (ratio < 1) {
    return { score: 20, ratio, hasNoCost: false };
  }
  if (ratio <= 2) {
    return { score: 40, ratio, hasNoCost: false };
  }
  if (ratio <= 4) {
    return { score: 60, ratio, hasNoCost: false };
  }
  if (ratio <= 8) {
    return { score: 80, ratio, hasNoCost: false };
  }

  return {
    score: clamp(95, 0, 100),
    ratio,
    hasNoCost: false,
  };
};
