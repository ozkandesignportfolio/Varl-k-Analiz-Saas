import "server-only";

import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isEmailConfirmed, classifyAuthError, getErrorMessage } from "./errors";
import { buildAuthRedirectPath, type AuthRedirectTarget } from "./redirects";
import type { User, Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

type CookieOptions = {
  name: string;
  value: string;
  options?: {
    path?: string;
    expires?: Date;
    maxAge?: number;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "strict" | "lax" | "none" | boolean;
  };
};

/**
 * Create a server-side Supabase client
 * This is the ONLY way to access Supabase on the server
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookie mutation can fail in some server contexts (e.g. pure Server Components).
          // Middleware refresh flow keeps auth cookies in sync for those cases.
        }
      },
    },
  });
}

/**
 * Get current session (no verification)
 */
export async function getSession() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

/**
 * Get current user (no verification)
 */
export async function getUser() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use this in Server Components and Route Handlers
 */
export async function requireAuth(
  redirectTarget: AuthRedirectTarget = "login",
  options?: { next?: string }
): Promise<{
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  user: User;
  session: Session;
}> {
  const supabase = await createServerClient();

  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  const session = sessionData.session;
  const user = userData.user;

  // Check both session and email confirmation
  if (!session || !user || !isEmailConfirmed(user)) {
    const next = options?.next ?? "/dashboard";
    redirect(buildAuthRedirectPath(redirectTarget, { next, email: user?.email }));
  }

  return { supabase, user, session };
}

/**
 * Check if user is authenticated (no redirect)
 * Use this when you need to conditionally show content
 */
export async function isAuthenticated(): Promise<boolean> {
  const { user } = await getUser();
  return Boolean(user && isEmailConfirmed(user));
}

/**
 * Require auth for API routes
 * Returns a Response object for API routes instead of redirecting
 */
export async function requireAuthForApi(): Promise<
  | {
      success: true;
      supabase: Awaited<ReturnType<typeof createServerClient>>;
      user: User;
    }
  | { success: false; response: Response }
> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || !isEmailConfirmed(data.user)) {
    const errorClassification = classifyAuthError(error);
    const message = getErrorMessage(errorClassification);

    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: "Unauthorized",
          message,
          code: errorClassification,
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      ),
    };
  }

  return { success: true, supabase, user: data.user };
}

/**
 * Get service role client for admin operations
 * Only use this server-side for cron jobs, admin operations, etc.
 */
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  // Dynamic import to avoid bundling issues
  const { createClient } = require("@supabase/supabase-js");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
