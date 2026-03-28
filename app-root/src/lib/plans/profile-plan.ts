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

const PROFILE_CREATE_RETRY_GUARD_MS = 60_000;
const profileCreateAttemptByUser = new Map<string, number>();

const fetchProfilePlan = async (client: DbClient, userId: string) =>
  (client.from("profiles").select("plan").eq("id", userId).maybeSingle() as unknown as Promise<{
    data: ProfilePlanRow | null;
    error: { message: string; code?: string | null } | null;
  }>);

const createDefaultProfile = async (client: DbClient, userId: string) => {
  const profilesTable = client.from("profiles") as unknown as {
    insert: (values: { id: string; plan: ProfilePlan }) => Promise<{ error: { message: string; code?: string | null } | null }>;
  };

  return profilesTable.insert({ id: userId, plan: "free" });
};

const isDuplicateProfileError = (error: { message: string; code?: string | null } | null) =>
  Boolean(error && (error.code === "23505" || /duplicate key/i.test(error.message)));

const shouldAttemptProfileCreate = (userId: string) => {
  const now = Date.now();
  const lastAttemptAt = profileCreateAttemptByUser.get(userId);

  if (typeof lastAttemptAt === "number" && now - lastAttemptAt < PROFILE_CREATE_RETRY_GUARD_MS) {
    return false;
  }

  profileCreateAttemptByUser.set(userId, now);
  return true;
};

const normalizePlanToken = (rawValue: unknown): ProfilePlan | null => {
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized === "premium" || normalized === "pro") {
    return "premium";
  }

  if (normalized === "free" || normalized === "starter") {
    return "free";
  }

  return null;
};

export const getProfilePlanFromUserMetadata = (
  user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined,
): ProfilePlan | null => {
  const metadataSources = [user?.app_metadata ?? null, user?.user_metadata ?? null];
  const metadataKeys = ["plan", "tier", "subscription_plan", "subscriptionPlan", "plan_code", "planCode"] as const;

  for (const source of metadataSources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    for (const key of metadataKeys) {
      const value = (source as Record<string, unknown>)[key];
      const planFromToken = normalizePlanToken(value);
      if (planFromToken) {
        return planFromToken;
      }
    }
  }

  return null;
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

  if (insertedProfile.error && !isDuplicateProfileError(insertedProfile.error)) {
    return { error: insertedProfile.error.message };
  }

  return { error: null };
}

export async function getOrCreateProfilePlan(
  client: DbClient,
  userId: string,
): Promise<{ plan: ProfilePlan; error: string | null }> {
  const profile = await getProfilePlan(client, userId);
  if (profile.error) {
    return { plan: "free", error: profile.error };
  }

  return { plan: profile.plan ?? "free", error: null };
}

export async function ensureProfile(
  client: DbClient,
  userId: string,
): Promise<{ plan: ProfilePlan; error: string | null }> {
  const initialProfile = await getProfilePlan(client, userId);
  if (initialProfile.error) {
    return { plan: "free", error: `profiles read error: ${initialProfile.error}` };
  }

  if (initialProfile.plan) {
    return { plan: initialProfile.plan, error: null };
  }

  if (!shouldAttemptProfileCreate(userId)) {
    return { plan: "free", error: null };
  }

  const insertResult = await createProfileIfMissing(client, userId);
  if (insertResult.error) {
    return { plan: "free", error: `profiles insert error: ${insertResult.error}` };
  }

  const profile = await getProfilePlan(client, userId);
  if (profile.error) {
    return { plan: "free", error: `profiles read-after-insert error: ${profile.error}` };
  }

  if (!profile.plan) {
    return { plan: "free", error: null };
  }

  return { plan: profile.plan, error: null };
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
