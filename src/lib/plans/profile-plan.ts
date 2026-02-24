import type { User } from "@supabase/supabase-js";
import { getPlanConfig, type PlanCode, type PlanConfig } from "@/lib/plans/plan-config";
import type { DbClient } from "@/lib/repos/_shared";

export type ProfilePlan = "free" | "premium";

const PROFILE_PLAN_TO_PLAN_CODE: Record<ProfilePlan, PlanCode> = {
  free: "starter",
  premium: "pro",
};

const PROFILE_PLAN_METADATA_FIELDS_BY_PLAN: Record<
  ProfilePlan,
  {
    plan: "free" | "premium";
    tier: "free" | "premium";
    plan_code: "starter" | "pro";
    planCode: "starter" | "pro";
    subscription_plan: "free" | "premium";
    subscriptionPlan: "free" | "premium";
  }
> = {
  free: {
    plan: "free",
    tier: "free",
    plan_code: "starter",
    planCode: "starter",
    subscription_plan: "free",
    subscriptionPlan: "free",
  },
  premium: {
    plan: "premium",
    tier: "premium",
    plan_code: "pro",
    planCode: "pro",
    subscription_plan: "premium",
    subscriptionPlan: "premium",
  },
};

export const normalizeProfilePlan = (rawPlan: unknown): ProfilePlan => {
  if (typeof rawPlan !== "string") {
    return "free";
  }

  const normalized = rawPlan.trim().toLowerCase();
  return normalized === "premium" ? "premium" : "free";
};

export const getPlanConfigFromProfilePlan = (plan: ProfilePlan): PlanConfig =>
  getPlanConfig(PROFILE_PLAN_TO_PLAN_CODE[plan]);

export const getPlanMetadataFromProfilePlan = (
  plan: ProfilePlan,
): Record<string, "starter" | "pro" | "free" | "premium"> => ({
  ...PROFILE_PLAN_METADATA_FIELDS_BY_PLAN[plan],
});

type ProfilePlanRow = {
  plan: string | null;
};

const fetchProfilePlan = async (client: DbClient, userId: string) =>
  (client.from("profiles").select("plan").eq("id", userId).maybeSingle() as unknown as Promise<{
    data: ProfilePlanRow | null;
    error: { message: string } | null;
  }>);

const createDefaultProfile = async (client: DbClient, userId: string) => {
  const profilesTable = client.from("profiles") as unknown as {
    upsert: (
      values: { id: string; plan: ProfilePlan },
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  };

  return profilesTable.upsert({ id: userId, plan: "free" }, { onConflict: "id", ignoreDuplicates: true });
};

export async function getOrCreateProfilePlan(
  client: DbClient,
  userId: string,
): Promise<{ plan: ProfilePlan; error: string | null }> {
  const existingProfile = await fetchProfilePlan(client, userId);

  if (existingProfile.error) {
    return { plan: "free", error: existingProfile.error.message };
  }

  if (existingProfile.data?.plan) {
    return { plan: normalizeProfilePlan(existingProfile.data.plan), error: null };
  }

  const insertedProfile = await createDefaultProfile(client, userId);
  if (insertedProfile.error) {
    return { plan: "free", error: insertedProfile.error.message };
  }

  const retriedProfile = await fetchProfilePlan(client, userId);
  if (retriedProfile.error) {
    return { plan: "free", error: retriedProfile.error.message };
  }

  return {
    plan: normalizeProfilePlan(retriedProfile.data?.plan),
    error: null,
  };
}

export const applyProfilePlanToUserMetadata = (
  user: Pick<User, "app_metadata" | "user_metadata">,
  plan: ProfilePlan,
) => {
  const planMetadata = getPlanMetadataFromProfilePlan(plan);

  return {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      ...planMetadata,
    },
    user_metadata: {
      ...(user.user_metadata ?? {}),
      ...planMetadata,
    },
  };
};
