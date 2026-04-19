import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAppUrl } from "@/lib/env/public-env";
import {
  isAllowedAuthOrigin,
  safeRedirect,
  validateRedirectUrl,
} from "@/lib/safety/auth-guards";

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

/**
 * Get the base URL for redirects.
 * Delegates to `requireAppUrl()` which returns a safe fallback during
 * build / prerender and only throws at real request-time.
 */
function getBaseUrl(): string {
  return requireAppUrl().replace(/\/$/, "");
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
  const safeNextPath = validateRedirectUrl(options?.next);
  if (safeNextPath) {
    params.set("next", safeNextPath);
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
  return NextResponse.redirect(safeRedirect(getBaseUrl(), redirectPath));
}

/**
 * Server-side redirect to dashboard
 */
export function redirectToDashboard(options?: { next?: string }) {
  const target = validateRedirectUrl(options?.next) ?? "/dashboard";
  return NextResponse.redirect(safeRedirect(getBaseUrl(), target));
}

/**
 * Server-side redirect to verify-email
 */
export function redirectToVerifyEmail(options?: { email?: string | null; next?: string }) {
  const redirectPath = buildAuthRedirectPath("verify-email", options);
  return NextResponse.redirect(safeRedirect(getBaseUrl(), redirectPath));
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
  return NextResponse.redirect(safeRedirect(baseUrl, redirectUrl));
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
    return isAllowedAuthOrigin(origin);
  } catch {
    return false;
  }
}

/**
 * Get safe next path from a query parameter
 */
export function getSafeNextPath(candidate: string | null): string {
  return validateRedirectUrl(candidate) ?? "/dashboard";
}
