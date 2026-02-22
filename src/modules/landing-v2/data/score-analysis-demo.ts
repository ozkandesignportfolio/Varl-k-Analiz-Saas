export type ScoreExampleAsset = {
  title: string;
  valueTl: number;
  last12MonthServiceCostTl: number;
  warrantyRemainingMonths: number;
  documentsCompleted: number;
  documentsTotal: number;
  lastMaintenanceMonthsAgo: number;
  score: number;
  scoreLabel: "İyi";
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
  title: "Örnek: No-Frost Buzdolabı (Ev)",
  valueTl: 28000,
  last12MonthServiceCostTl: 1450,
  warrantyRemainingMonths: 8,
  documentsCompleted: 4,
  documentsTotal: 5,
  lastMaintenanceMonthsAgo: 2,
  score: 82,
  scoreLabel: "İyi",
  improvements: [
    { action: "Eksik belgeyi tamamlayın", scoreGain: 6 },
    { action: "Yaklaşan bakım için hatırlatma kurun", scoreGain: 4 },
  ],
};

export const scoreBreakdown: ScoreBreakdownItem[] = [
  { key: "warranty", label: "Garanti", score: 90, toneClass: "bg-emerald-400/85" },
  { key: "maintenance", label: "Bakım", score: 75, toneClass: "bg-cyan-400/85" },
  { key: "documents", label: "Belgeler", score: 70, toneClass: "bg-blue-400/85" },
  { key: "payments", label: "Ödemeler", score: 95, toneClass: "bg-indigo-400/85" },
];

export const scoreTrend: ScoreTrendPoint[] = [
  { month: "Eyl", score: 74 },
  { month: "Eki", score: 76 },
  { month: "Kas", score: 78 },
  { month: "Ara", score: 80 },
  { month: "Oca", score: 79 },
  { month: "Şub", score: 82 },
];

export const costEfficiencyRatio = Number((exampleAsset.valueTl / exampleAsset.last12MonthServiceCostTl).toFixed(1));
