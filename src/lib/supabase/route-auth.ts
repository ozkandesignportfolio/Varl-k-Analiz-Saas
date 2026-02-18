import "server-only";

import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RouteAuthSuccess = {
  supabase: RouteSupabaseClient;
  user: User;
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
  const bearerToken = extractBearerToken(request);

  const {
    data: { user },
    error,
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: UNAUTHORIZED_ERROR }, { status: 401 }),
    };
  }

  return {
    supabase,
    user,
  };
}
