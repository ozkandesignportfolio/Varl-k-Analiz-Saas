import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  applyProfilePlanToUserMetadata,
  getProfilePlan,
  getProfilePlanFromUserMetadata,
  type ProfilePlan,
} from "@/lib/plans/profile-plan";
import type { DbClient } from "@/lib/repos/_shared";
import { isSupabaseUserEmailConfirmed } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

type RouteSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RouteAuthSuccess = {
  supabase: RouteSupabaseClient;
  user: User;
  profilePlan: ProfilePlan;
};

export type RouteAuthFailure = {
  response: NextResponse<{ error: string }>;
};

const UNAUTHORIZED_ERROR = "Unauthorized";
const PROFILE_PLAN_CACHE_TTL_MS = 30_000;
const profilePlanCache = new Map<string, { plan: ProfilePlan; expiresAt: number }>();

const getCachedProfilePlan = (userId: string): ProfilePlan | null => {
  const cacheEntry = profilePlanCache.get(userId);
  if (!cacheEntry) {
    return null;
  }

  if (cacheEntry.expiresAt <= Date.now()) {
    profilePlanCache.delete(userId);
    return null;
  }

  return cacheEntry.plan;
};

const setCachedProfilePlan = (userId: string, plan: ProfilePlan) => {
  profilePlanCache.set(userId, {
    plan,
    expiresAt: Date.now() + PROFILE_PLAN_CACHE_TTL_MS,
  });
};

const resolveRouteProfilePlan = async (
  client: DbClient,
  user: User,
): Promise<{ plan: ProfilePlan; error: string | null }> => {
  const metadataPlan = getProfilePlanFromUserMetadata(user);
  if (metadataPlan) {
    setCachedProfilePlan(user.id, metadataPlan);
    return { plan: metadataPlan, error: null };
  }

  const cachedPlan = getCachedProfilePlan(user.id);
  if (cachedPlan) {
    return { plan: cachedPlan, error: null };
  }

  const profile = await getProfilePlan(client, user.id);
  if (profile.error) {
    return { plan: "free", error: profile.error };
  }

  const resolvedPlan: ProfilePlan = profile.plan ?? "free";
  setCachedProfilePlan(user.id, resolvedPlan);
  return { plan: resolvedPlan, error: null };
};

const extractBearerToken = (request: Request) => {
  const headerValue = request.headers.get("authorization");
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }

  const normalizedToken = token.trim();
  return normalizedToken || null;
};

export async function requireRouteUser(
  request: Request,
): Promise<RouteAuthSuccess | RouteAuthFailure> {
  const supabase = await createClient();
  const dbClient = supabase as unknown as DbClient;
  const bearerToken = extractBearerToken(request);

  const {
    data: { user },
    error,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();
  const authenticatedUser = user;
  const authenticatedError = error;

  if (authenticatedError || !authenticatedUser || !isSupabaseUserEmailConfirmed(authenticatedUser)) {
    return {
      response: NextResponse.json({ error: UNAUTHORIZED_ERROR }, { status: 401 }),
    };
  }

  const profilePlanResult = await resolveRouteProfilePlan(dbClient, authenticatedUser);
  const resolvedProfilePlan: ProfilePlan = profilePlanResult.plan;
  const resolvedUser = {
    ...authenticatedUser,
    ...applyProfilePlanToUserMetadata(authenticatedUser, resolvedProfilePlan),
  } as User;

  return {
    supabase,
    user: resolvedUser,
    profilePlan: resolvedProfilePlan,
  };
}
