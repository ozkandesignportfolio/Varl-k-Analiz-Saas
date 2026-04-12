import "server-only";

import { createServerClient, isAuthenticated } from "./server";
import { isEmailConfirmed } from "./errors";

/**
 * Session Management Utilities
 * ==========================
 *
 * Server-side session management helpers.
 * All session operations happen on the server only.
 */

/**
 * Get verified session (user with confirmed email)
 */
export async function getVerifiedSession() {
  const supabase = await createServerClient();

  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  const session = sessionData.session;
  const user = userData.user;

  if (!session || !user || !isEmailConfirmed(user)) {
    return { session: null, user: null, isAuthenticated: false };
  }

  return { session, user, isAuthenticated: true };
}

/**
 * Require verified user - throws or returns null if not verified
 */
export async function requireVerifiedUser() {
  const { session, user, isAuthenticated } = await getVerifiedSession();

  if (!isAuthenticated || !session || !user) {
    return null;
  }

  return { session, user };
}

/**
 * Sign out user if their email is not verified
 * Use this to clean up sessions for unverified users
 */
export async function signOutIfUnverified(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (userData.user && !isEmailConfirmed(userData.user)) {
    await supabase.auth.signOut();
    return true;
  }

  return false;
}

/**
 * Refresh session if needed
 */
export async function refreshSession() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    return { session: null, user: null, error };
  }

  return {
    session: data.session,
    user: data.user,
    error: null,
  };
}

// Re-export for convenience
export { isAuthenticated };
