import type { User } from "@supabase/supabase-js";
import { getUserPlanConfig } from "@/lib/plans/plan-config";

const PLAN_METADATA_KEYS = [
  "plan_code",
  "planCode",
  "plan",
  "subscription_plan",
  "subscriptionPlan",
  "tier",
] as const;

const parseBooleanEnv = (value: string | undefined) => value?.trim().toLowerCase() === "true";

const hasPlanMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  const record = metadata as Record<string, unknown>;
  return PLAN_METADATA_KEYS.some((key) => typeof record[key] === "string" && record[key].trim().length > 0);
};

export const isPremiumMediaFeatureFlagEnabled = () =>
  parseBooleanEnv(process.env.NEXT_PUBLIC_FEATURE_PREMIUM_MEDIA_DEFAULT) ||
  parseBooleanEnv(process.env.FEATURE_PREMIUM_MEDIA_DEFAULT);

export type PremiumPlanState = "free" | "premium";

export const canPlanUsePremiumMedia = (plan: PremiumPlanState) => {
  if (plan === "premium") {
    return true;
  }

  return isPremiumMediaFeatureFlagEnabled();
};

export const canUserUsePremiumMedia = (user: Pick<User, "app_metadata" | "user_metadata">) => {
  const metadataHasPlan = hasPlanMetadata(user.app_metadata) || hasPlanMetadata(user.user_metadata);

  if (!metadataHasPlan) {
    return isPremiumMediaFeatureFlagEnabled();
  }

  return getUserPlanConfig(user).code !== "starter";
};
