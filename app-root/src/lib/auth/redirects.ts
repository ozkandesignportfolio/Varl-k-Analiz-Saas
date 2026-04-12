import "server-only";

import { NextResponse, type NextRequest } from "next/server";

/**
 * Deterministic Redirect System
 * =============================
 *
 * ALL redirects go through this system to ensure consistency.
 * No arbitrary redirects allowed - only these defined targets.
 */

export type AuthRedirectTarget =
  | "login"
  | "dashboard"
  | "verify-email"
  | "register"
  | "forgot-password"
  | "reset-password";

const REDIRECT_PATHS: Record<AuthRedirectTarget, string> = {
  login: "/login",
  dashboard: "/dashboard",
  "verify-email": "/verify-email",
  register: "/register",
  "forgot-password": "/forgot-password",
  "reset-password": "/reset-password",
};

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
].filter(Boolean));

/**
 * Get the base URL for redirects
 */
function getBaseUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!appUrl) {
    throw new Error("Missing APP_URL or NEXT_PUBLIC_APP_URL environment variable");
  }
  return appUrl.replace(/\/$/, "");
}

/**
 * Validate that a path is safe for redirects
 * Only allows relative paths starting with /
 */
function isSafePath(path: string): boolean {
  // Must start with / and not be //
  if (!path.startsWith("/") || path.startsWith("//")) {
    return false;
  }
  // No protocol indicators
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return false;
  }
  return true;
}

/**
 * Build a redirect URL with query parameters
 */
export function buildAuthRedirect(
  target: AuthRedirectTarget,
  options?: {
    next?: string;
    email?: string | null;
    error?: string;
    emailVerified?: boolean;
    emailVerificationRequired?: boolean;
  }
): string {
  const baseUrl = getBaseUrl();
  const path = REDIRECT_PATHS[target];
  const params = new URLSearchParams();

  // Add next parameter (validated)
  if (options?.next && isSafePath(options.next)) {
    params.set("next", options.next);
  }

  // Add email parameter
  if (options?.email) {
    params.set("email", options.email.trim());
  }

  // Add error parameter
  if (options?.error) {
    params.set("error", options.error);
  }

  // Add email verified flag
  if (options?.emailVerified) {
    params.set("email_verified", "1");
  }

  // Add email verification required flag
  if (options?.emailVerificationRequired) {
    params.set("email_verification_required", "1");
  }

  const query = params.toString();
  return query ? `${baseUrl}${path}?${query}` : `${baseUrl}${path}`;
}

/**
 * Build a redirect URL for Next.js redirect function
 */
export function buildAuthRedirectPath(
  target: AuthRedirectTarget,
  options?: Parameters<typeof buildAuthRedirect>[1]
): string {
  const fullUrl = buildAuthRedirect(target, options);
  return fullUrl.replace(getBaseUrl(), "");
}

/**
 * Server-side redirect to login
 */
export function redirectToLogin(options?: { next?: string; email?: string | null }) {
  const redirectPath = buildAuthRedirectPath("login", options);
  return NextResponse.redirect(new URL(redirectPath, getBaseUrl()));
}

/**
 * Server-side redirect to dashboard
 */
export function redirectToDashboard(options?: { next?: string }) {
  const target = options?.next && isSafePath(options.next) ? options.next : "/dashboard";
  return NextResponse.redirect(new URL(target, getBaseUrl()));
}

/**
 * Server-side redirect to verify-email
 */
export function redirectToVerifyEmail(options?: { email?: string | null; next?: string }) {
  const redirectPath = buildAuthRedirectPath("verify-email", options);
  return NextResponse.redirect(new URL(redirectPath, getBaseUrl()));
}

/**
 * Build a NextResponse for auth redirects
 * Use this in Route Handlers and Middleware
 */
export function buildAuthRedirectResponse(
  request: NextRequest,
  target: AuthRedirectTarget,
  options?: Parameters<typeof buildAuthRedirect>[1]
): NextResponse {
  const baseUrl = request.url.startsWith("http") ? request.url : getBaseUrl();
  const redirectUrl = buildAuthRedirect(target, options);
  return NextResponse.redirect(new URL(redirectUrl, baseUrl));
}

/**
 * Copy auth cookies from one response to another
 * Use this when creating new redirect responses to preserve session
 */
export function copyAuthCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

/**
 * Check if a URL is an allowed redirect origin
 */
export function isAllowedRedirectOrigin(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    return ALLOWED_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

/**
 * Get safe next path from a query parameter
 */
export function getSafeNextPath(candidate: string | null): string {
  if (!candidate || !isSafePath(candidate)) {
    return "/dashboard";
  }
  return candidate;
}
