export type ScoreExampleAsset = {
  title: string;
  valueTl: number;
  last12MonthServiceCostTl: number;
  warrantyRemainingMonths: number;
  documentsCompleted: number;
  documentsTotal: number;
  lastMaintenanceMonthsAgo: number;
  score: number;
  scoreLabel: "Good";
  improvements: Array<{
    action: string;
    scoreGain: number;
  }>;
};

export type ScoreBreakdownItem = {
  key: "warranty" | "maintenance" | "documents" | "payments";
  label: string;
  score: number;
  toneClass: string;
};

export type ScoreTrendPoint = {
  month: string;
  score: number;
};

export const exampleAsset: ScoreExampleAsset = {
  title: "Example: Design Platform (Design Team)",
  valueTl: 28800,
  last12MonthServiceCostTl: 2400,
  warrantyRemainingMonths: 9,
  documentsCompleted: 4,
  documentsTotal: 5,
  lastMaintenanceMonthsAgo: 1,
  score: 82,
  scoreLabel: "Good",
  improvements: [
    { action: "Upload missing contract", scoreGain: 6 },
    { action: "Cancel unused licenses", scoreGain: 4 },
  ],
};

export const scoreBreakdown: ScoreBreakdownItem[] = [
  { key: "warranty", label: "License", score: 90, toneClass: "bg-emerald-400/85" },
  { key: "maintenance", label: "Usage", score: 75, toneClass: "bg-cyan-400/85" },
  { key: "documents", label: "Contracts", score: 70, toneClass: "bg-blue-400/85" },
  { key: "payments", label: "Payments", score: 95, toneClass: "bg-indigo-400/85" },
];

export const scoreTrend: ScoreTrendPoint[] = [
  { month: "Sep", score: 74 },
  { month: "Oct", score: 76 },
  { month: "Nov", score: 78 },
  { month: "Dec", score: 80 },
  { month: "Jan", score: 79 },
  { month: "Feb", score: 82 },
];

export const costEfficiencyRatio = Number((exampleAsset.valueTl / exampleAsset.last12MonthServiceCostTl).toFixed(1));
