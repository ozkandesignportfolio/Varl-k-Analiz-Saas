import "server-only";

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { ServerEnv } from "@/lib/env/server-env";
import { isAdminUser } from "@/lib/auth/admin-user";
import { isSupabaseUserEmailConfirmed } from "@/lib/supabase/auth-errors";
import { buildLoginPath } from "@/lib/supabase/email-verification";
import { requireRouteUser, type RouteAuthFailure, type RouteAuthSuccess } from "@/lib/supabase/route-auth";
import { createClient } from "@/lib/supabase/server";

type AdminRouteAuthSuccess = RouteAuthSuccess & {
  accessMode: "secret" | "user";
};

type AdminRouteAuthFailure = RouteAuthFailure;

const ADMIN_SECRET_HEADER = "x-admin-dashboard-secret";

const getAdminDashboardSecret = () => ServerEnv.ADMIN_DASHBOARD_SECRET;

const hasValidAdminSecret = (request: Request) => {
  const configuredSecret = getAdminDashboardSecret();
  const presentedSecret = request.headers.get(ADMIN_SECRET_HEADER)?.trim() || null;

  if (!configuredSecret || !presentedSecret) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredSecret);
  const presentedBuffer = Buffer.from(presentedSecret);

  if (configuredBuffer.length !== presentedBuffer.length) {
    return false;
  }

  return timingSafeEqual(configuredBuffer, presentedBuffer);
};

export const requireAdminRouteAccess = async (
  request: Request,
): Promise<AdminRouteAuthSuccess | AdminRouteAuthFailure> => {
  if (hasValidAdminSecret(request)) {
    return {
      accessMode: "secret",
      profilePlan: "premium",
      supabase: await createClient(),
      user: {
        app_metadata: { role: "admin" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
        email: "admin-secret@local",
        id: "admin-secret",
        user_metadata: {},
      } as AdminRouteAuthSuccess["user"],
    };
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth;
  }

  if (!isAdminUser(auth.user)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ...auth,
    accessMode: "user",
  };
};

export const requireAdminPageAccess = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const authenticatedUser = user && isSupabaseUserEmailConfirmed(user) ? user : null;

  if (!authenticatedUser) {
    redirect(buildLoginPath("/fraud-dashboard"));
  }

  if (!isAdminUser(authenticatedUser)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    user: authenticatedUser,
  };
};
