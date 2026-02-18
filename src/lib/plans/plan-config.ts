import type { User } from "@supabase/supabase-js";

export type PlanCode = "starter" | "pro" | "elite";

type PlanLimits = {
  maxAssets: number | null;
  maxDocumentStorageBytes: number | null;
};

type PlanFeatures = {
  canExportReports: boolean;
};

export type PlanConfig = {
  code: PlanCode;
  label: string;
  limits: PlanLimits;
  features: PlanFeatures;
};

const MB = 1024 * 1024;

const PLAN_CONFIGS: Record<PlanCode, PlanConfig> = {
  starter: {
    code: "starter",
    label: "Starter",
    limits: {
      maxAssets: 3,
      maxDocumentStorageBytes: 250 * MB,
    },
    features: {
      canExportReports: false,
    },
  },
  pro: {
    code: "pro",
    label: "Pro",
    limits: {
      maxAssets: null,
      maxDocumentStorageBytes: null,
    },
    features: {
      canExportReports: true,
    },
  },
  elite: {
    code: "elite",
    label: "Elite",
    limits: {
      maxAssets: null,
      maxDocumentStorageBytes: null,
    },
    features: {
      canExportReports: true,
    },
  },
};

const PLAN_ALIASES: Record<string, PlanCode> = {
  starter: "starter",
  free: "starter",
  pro: "pro",
  premium: "pro",
  elite: "elite",
};

const DEFAULT_PLAN_CODE: PlanCode = "starter";

const pickPlanMetadataValue = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  return (
    record.plan_code ??
    record.planCode ??
    record.plan ??
    record.subscription_plan ??
    record.subscriptionPlan ??
    record.tier ??
    null
  );
};

const normalizePlanCode = (raw: unknown): PlanCode => {
  if (typeof raw !== "string") {
    return DEFAULT_PLAN_CODE;
  }

  const key = raw.trim().toLowerCase();
  return PLAN_ALIASES[key] ?? DEFAULT_PLAN_CODE;
};

export const formatStorageBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const mb = bytes / MB;
  return `${mb.toFixed(0)} MB`;
};

export const getPlanConfig = (code: PlanCode) => PLAN_CONFIGS[code];

export const getUserPlanConfig = (user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined) => {
  const appMetadataCode = pickPlanMetadataValue(user?.app_metadata);
  const userMetadataCode = pickPlanMetadataValue(user?.user_metadata);
  const code = normalizePlanCode(appMetadataCode ?? userMetadataCode);
  return PLAN_CONFIGS[code];
};
