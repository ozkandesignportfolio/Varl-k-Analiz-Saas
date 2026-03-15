import type { User } from "@supabase/supabase-js";

export type PlanCode = "starter" | "pro" | "elite";

type PlanLimits = {
  assetsLimit: number | null;
  documentsLimit: number | null;
  subscriptionsLimit: number | null;
  invoiceUploadsLimit: number | null;
};

type PlanFeatures = {
  canExportPdfReports: boolean;
  canUseAdvancedAnalytics: boolean;
  canUseAutomation: boolean;
  hasPrioritySupport: boolean;
};

export type PlanConfig = {
  code: PlanCode;
  label: string;
  limits: PlanLimits;
  features: PlanFeatures;
};

const PLAN_CONFIGS: Record<PlanCode, PlanConfig> = {
  starter: {
    code: "starter",
    label: "Deneme",
    limits: {
      assetsLimit: 3,
      documentsLimit: 5,
      subscriptionsLimit: 3,
      invoiceUploadsLimit: 3,
    },
    features: {
      canExportPdfReports: false,
      canUseAdvancedAnalytics: false,
      canUseAutomation: false,
      hasPrioritySupport: false,
    },
  },
  pro: {
    code: "pro",
    label: "Premium",
    limits: {
      assetsLimit: null,
      documentsLimit: null,
      subscriptionsLimit: null,
      invoiceUploadsLimit: null,
    },
    features: {
      canExportPdfReports: true,
      canUseAdvancedAnalytics: true,
      canUseAutomation: true,
      hasPrioritySupport: true,
    },
  },
  elite: {
    code: "elite",
    label: "Premium",
    limits: {
      assetsLimit: null,
      documentsLimit: null,
      subscriptionsLimit: null,
      invoiceUploadsLimit: null,
    },
    features: {
      canExportPdfReports: true,
      canUseAdvancedAnalytics: true,
      canUseAutomation: true,
      hasPrioritySupport: true,
    },
  },
};

const PLAN_ALIASES: Record<string, PlanCode> = {
  starter: "starter",
  free: "starter",
  trial: "starter",
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

export const getPlanConfig = (code: PlanCode) => PLAN_CONFIGS[code];

export const getUserPlanConfig = (user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined) => {
  const appMetadataCode = pickPlanMetadataValue(user?.app_metadata);
  const userMetadataCode = pickPlanMetadataValue(user?.user_metadata);
  const code = normalizePlanCode(appMetadataCode ?? userMetadataCode);
  return PLAN_CONFIGS[code];
};

type PlanLimitResource = "asset" | "document" | "subscription" | "invoiceUpload";

type PlanLimitGuardParams = {
  planConfig: PlanConfig;
  resource: PlanLimitResource;
  currentCount: number;
  requestedCount?: number;
};

type PlanLimitGuardResult = {
  allowed: boolean;
  limit: number | null;
  currentCount: number;
  projectedCount: number;
  errorMessage: string | null;
};

const planLimitFieldByResource: Record<PlanLimitResource, keyof PlanLimits> = {
  asset: "assetsLimit",
  document: "documentsLimit",
  subscription: "subscriptionsLimit",
  invoiceUpload: "invoiceUploadsLimit",
};

const planLimitMessageByResource = (resource: PlanLimitResource, limit: number) => {
  switch (resource) {
    case "asset":
      return `Deneme planında en fazla ${limit} varlık ekleyebilirsiniz.`;
    case "document":
      return `Deneme planında en fazla ${limit} belge yükleyebilirsiniz.`;
    case "subscription":
      return `Deneme planında en fazla ${limit} abonelik ekleyebilirsiniz.`;
    case "invoiceUpload":
      return `Deneme planında en fazla ${limit} fatura oluşturabilirsiniz.`;
    default:
      return "Plan limitine ulaştınız.";
  }
};

const applyPlanLimitGuard = (params: PlanLimitGuardParams): PlanLimitGuardResult => {
  const { currentCount, planConfig, requestedCount = 1, resource } = params;
  const normalizedCurrentCount = Number.isFinite(currentCount) && currentCount > 0 ? currentCount : 0;
  const normalizedRequestedCount = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 1;
  const limit = planConfig.limits[planLimitFieldByResource[resource]];
  const projectedCount = normalizedCurrentCount + normalizedRequestedCount;

  if (limit === null) {
    return {
      allowed: true,
      limit,
      currentCount: normalizedCurrentCount,
      projectedCount,
      errorMessage: null,
    };
  }

  if (projectedCount <= limit) {
    return {
      allowed: true,
      limit,
      currentCount: normalizedCurrentCount,
      projectedCount,
      errorMessage: null,
    };
  }

  return {
    allowed: false,
    limit,
    currentCount: normalizedCurrentCount,
    projectedCount,
    errorMessage: planLimitMessageByResource(resource, limit),
  };
};

export const canCreateAsset = (params: Omit<PlanLimitGuardParams, "resource">) =>
  applyPlanLimitGuard({ ...params, resource: "asset" });

export const canUploadDocument = (params: Omit<PlanLimitGuardParams, "resource">) =>
  applyPlanLimitGuard({ ...params, resource: "document" });

export const canCreateSubscription = (params: Omit<PlanLimitGuardParams, "resource">) =>
  applyPlanLimitGuard({ ...params, resource: "subscription" });

export const canUploadInvoice = (params: Omit<PlanLimitGuardParams, "resource">) =>
  applyPlanLimitGuard({ ...params, resource: "invoiceUpload" });
