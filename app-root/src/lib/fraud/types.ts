import type { SignupRiskLevel } from "@/lib/supabase/signup";

export const FRAUD_DASHBOARD_EVENT_TYPES = [
  "all",
  "signup_success",
  "blocked",
  "rate_limited",
  "invalid_turnstile",
] as const;

export type FraudDashboardFilterEventType = (typeof FRAUD_DASHBOARD_EVENT_TYPES)[number];
export type FraudDashboardEventType = Exclude<FraudDashboardFilterEventType, "all">;

export type FraudStatsFilters = {
  email: string;
  eventType: FraudDashboardFilterEventType;
  ip: string;
  limit: number;
  riskMax: number;
  riskMin: number;
  windowHours: number;
};

export type FraudRiskSources = {
  device: number;
  email: number;
  ip: number;
  metadata: number;
};

export type FraudAttempt = {
  consentedAt: string | null;
  deviceFingerprint: string | null;
  email: string | null;
  eventType: FraudDashboardEventType;
  id: string;
  ip: string | null;
  occurredAt: string;
  rawEventType: string;
  riskLevel: SignupRiskLevel;
  riskScore: number;
  riskSources: FraudRiskSources;
  userAgent: string | null;
  userId: string | null;
};

export type FraudMetricSummary = {
  averageRiskScore: number;
  blockedAttempts: number;
  highRiskUsersCount: number;
  successfulSignups: number;
  totalSignups: number;
};

export type FraudRankedEntity = {
  averageRiskScore: number;
  count: number;
  lastSeenAt: string;
  maxRiskScore: number;
  value: string;
};

export type FraudVolumePoint = {
  blocked: number;
  invalidTurnstile: number;
  label: string;
  rateLimited: number;
  successful: number;
  total: number;
};

export type FraudRiskDistributionPoint = {
  count: number;
  label: string;
};

export type FraudOutcomePoint = {
  label: string;
  value: number;
};

export type FraudStatsResponse = {
  attempts: FraudAttempt[];
  charts: {
    blockedVsSuccessful: FraudOutcomePoint[];
    riskDistribution: FraudRiskDistributionPoint[];
    signupVolume: FraudVolumePoint[];
  };
  filters: FraudStatsFilters;
  generatedAt: string;
  summary: FraudMetricSummary;
  topRiskyEmails: FraudRankedEntity[];
  topRiskyIps: FraudRankedEntity[];
};
