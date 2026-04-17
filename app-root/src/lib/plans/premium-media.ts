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
  // SECURITY: Only app_metadata (service-role writable) is trusted for plan
  // resolution. user_metadata is writable by the authenticated user itself
  // via supabase.auth.updateUser() and would allow a free account to
  // self-upgrade from the browser console.
  const metadataHasPlan = hasPlanMetadata(user.app_metadata);

  if (!metadataHasPlan) {
    return isPremiumMediaFeatureFlagEnabled();
  }

  return getUserPlanConfig(user).code !== "starter";
};
