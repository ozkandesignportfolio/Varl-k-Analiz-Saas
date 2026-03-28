export type PanelHealthScope = "user" | "public_fallback";

export type PanelHealthPayload = {
  score: number;
  ratio: number;
  hasNoCost: boolean;
  assetPrice: number;
  totalCost: number;
  maintenanceCost: number;
  expenseCost: number;
  warranty: {
    score: number;
    active: number;
    expiring: number;
    expired: number;
    unknown: number;
  };
  maintenance: {
    score: number;
    planned: number;
    completed: number;
    onTrack: number;
    overdue: number;
  };
  documents: {
    score: number;
    required: number;
    uploaded: number;
    missing: number;
  };
  payments: {
    score: number;
    paid: number;
    pending: number;
    overdue: number;
    total: number;
  };
  scope: PanelHealthScope;
  warning: string | null;
  generatedAt: string;
};

export const createEmptyPanelHealthPayload = (scope: PanelHealthScope = "public_fallback"): PanelHealthPayload => ({
  score: 0,
  ratio: 0,
  hasNoCost: false,
  assetPrice: 0,
  totalCost: 0,
  maintenanceCost: 0,
  expenseCost: 0,
  warranty: {
    score: 0,
    active: 0,
    expiring: 0,
    expired: 0,
    unknown: 0,
  },
  maintenance: {
    score: 0,
    planned: 0,
    completed: 0,
    onTrack: 0,
    overdue: 0,
  },
  documents: {
    score: 0,
    required: 0,
    uploaded: 0,
    missing: 0,
  },
  payments: {
    score: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    total: 0,
  },
  scope,
  warning: null,
  generatedAt: new Date().toISOString(),
});
