/**
 * Verification code utilities for email confirmation flow.
 * Generates, hashes, and validates 6-digit verification codes.
 */

const CODE_LENGTH = 6;
const CODE_MODULO = 10 ** CODE_LENGTH; // 1_000_000

/** Code expires after 10 minutes */
export const CODE_EXPIRY_MS = 10 * 60 * 1_000;

/** Maximum failed verification attempts before lockout */
export const MAX_VERIFICATION_ATTEMPTS = 5;

/** Generate a cryptographically random 6-digit verification code */
export function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % CODE_MODULO).padStart(CODE_LENGTH, "0");
}

/** Hash a verification code using SHA-256 */
export async function hashVerificationCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Get the ISO timestamp when the code should expire */
export function getCodeExpiryTimestamp(): string {
  return new Date(Date.now() + CODE_EXPIRY_MS).toISOString();
}

/** Check if a code has expired */
export function isCodeExpired(expiryIso: string): boolean {
  return new Date(expiryIso).getTime() < Date.now();
}

/** Check if max attempts reached */
export function isMaxAttemptsReached(attempts: number): boolean {
  return attempts >= MAX_VERIFICATION_ATTEMPTS;
}

/** Verification metadata shape stored in user_metadata */
export type VerificationMetadata = {
  code_hash: string;
  expires_at: string;
  attempts: number;
};
