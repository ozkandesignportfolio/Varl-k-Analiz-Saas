import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  applyProfilePlanToUserMetadata,
  getOrCreateProfilePlan,
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

  const profilePlanResult = await getOrCreateProfilePlan(dbClient, authenticatedUser.id);
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
