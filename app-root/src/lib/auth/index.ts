/**
 * Production-Grade Auth Architecture
 * ================================
 *
 * SINGLE SOURCE OF TRUTH: All auth flows go through /auth/callback
 *
 * Architecture Principles:
 * 1. Single callback route (/auth/callback) handles ALL auth verification
 * 2. NO auth logic in UI pages - pages are pure presentation
 * 3. Server-side session handling only
 * 4. Deterministic redirects with clear rules
 * 5. Complete audit logging for all email events
 *
 * Flow:
 * email link → supabase → /auth/callback → verify → dashboard
 * cron job → reminder emails → resend → tracking table
 *
 * Directory Structure:
 * - /src/lib/auth/index.ts           - This file (architecture overview)
 * - /src/lib/auth/server.ts          - Server-only auth utilities
 * - /src/lib/auth/redirects.ts       - Deterministic redirect logic
 * - /src/lib/auth/email-logger.ts    - Email event logging
 * - /src/lib/auth/session.ts         - Session management
 * - /src/lib/auth/verify.ts          - Verification helpers
 * - /src/lib/auth/errors.ts          - Error classification
 * - /src/lib/auth/admin.ts           - Admin access utilities
 * - /src/app/auth/callback/route.ts  - Single callback handler
 * - /src/app/api/cron/email-reminder/route.ts - Cron job endpoint
 */

// Re-export all auth utilities for clean imports
export { createServerClient, requireAuth, getSession, getUser } from "./server";
export {
  redirectToLogin,
  redirectToDashboard,
  redirectToVerifyEmail,
  buildAuthRedirect,
  type AuthRedirectTarget,
} from "./redirects";
export {
  logEmailEvent,
  logVerificationAttempt,
  logVerificationSuccess,
  logVerificationFailure,
  type EmailEventType,
} from "./email-logger";
export {
  isAuthenticated,
  requireVerifiedUser,
  getVerifiedSession,
  signOutIfUnverified,
} from "./session";
export {
  exchangeCodeForSession,
  verifyOtpToken,
  handlePostVerificationRedirect,
} from "./verify";
export {
  isEmailConfirmedError,
  isRateLimitError,
  isInvalidTokenError,
  classifyAuthError,
  type AuthErrorClassification,
} from "./errors";
