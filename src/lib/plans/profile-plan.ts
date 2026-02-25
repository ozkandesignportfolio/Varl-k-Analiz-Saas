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
  return rawPlan === "premium" ? "premium" : "free";
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

export async function getProfilePlan(
  client: DbClient,
  userId: string,
): Promise<{ plan: ProfilePlan | null; error: string | null }> {
  const profile = await fetchProfilePlan(client, userId);

  if (profile.error) {
    return { plan: null, error: profile.error.message };
  }

  if (!profile.data?.plan) {
    return { plan: null, error: null };
  }

  return { plan: normalizeProfilePlan(profile.data.plan), error: null };
}

export async function createProfileIfMissing(
  client: DbClient,
  userId: string,
): Promise<{ error: string | null }> {
  const insertedProfile = await createDefaultProfile(client, userId);

  if (insertedProfile.error) {
    return { error: insertedProfile.error.message };
  }

  return { error: null };
}

export async function getOrCreateProfilePlan(
  client: DbClient,
  userId: string,
): Promise<{ plan: ProfilePlan; error: string | null }> {
  const ensuredProfile = await ensureProfile(client, userId);
  if (ensuredProfile.error) {
    return { plan: "free", error: ensuredProfile.error };
  }

  return { plan: ensuredProfile.plan, error: null };
}

export async function ensureProfile(
  client: DbClient,
  userId: string,
): Promise<{ plan: ProfilePlan; error: string | null }> {
  const insertResult = await createDefaultProfile(client, userId);
  if (insertResult.error) {
    return { plan: "free", error: `profiles upsert error: ${insertResult.error.message}` };
  }

  const profile = await fetchProfilePlan(client, userId);
  if (profile.error) {
    return { plan: "free", error: `profiles read error: ${profile.error.message}` };
  }

  return { plan: normalizeProfilePlan(profile.data?.plan), error: null };
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
