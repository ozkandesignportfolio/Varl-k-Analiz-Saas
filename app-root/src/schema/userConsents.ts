import { Runtime } from "@/lib/env/runtime";

/**
 * USER_CONSENTS SCHEMA CONTRACT
 * 
 * SINGLE SOURCE OF TRUTH - DO NOT MODIFY WITHOUT DATABASE MIGRATION
 * 
 * Final Schema (3 columns only):
 * - user_id: uuid (primary key, references auth.users)
 * - accepted_terms: boolean (NOT NULL)
 * - consented_at: timestamptz (NOT NULL, default now())
 * 
 * IDEMPOTENT OPERATIONS:
 * - Always use upsert({ onConflict: "user_id" }) instead of insert()
 * - Safe to call multiple times - no duplicate key errors
 * - Database function: upsert_user_consent(p_user_id, p_accepted_terms, p_consented_at)
 * 
 * DELETED FIELDS (permanently removed):
 * - accepted_kvkk ❌
 * - accepted_privacy_policy ❌
 * - id (replaced by user_id as PK) ❌
 * - email ❌
 * - ip ❌
 * - user_agent ❌
 * - created_at (redundant with consented_at) ❌
 */

// Strict runtime validation
const ALLOWED_FIELDS = ["user_id", "accepted_terms", "consented_at"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

// Database schema types - matches Supabase exactly
export interface UserConsentsRow {
  user_id: string;
  accepted_terms: boolean;
  consented_at: string;
}

export interface UserConsentsInsert {
  user_id: string;
  accepted_terms: boolean;
  consented_at?: string; // Has default in DB
}

export interface UserConsentsUpdate {
  user_id?: string;
  accepted_terms?: boolean;
  consented_at?: string;
}

// Runtime validation - throws on unexpected fields
export function validateUserConsentsPayload(
  payload: Record<string, unknown>,
  operation: "insert" | "update"
): asserts payload is Record<AllowedField, unknown> {
  const payloadFields = Object.keys(payload);
  const invalidFields = payloadFields.filter(
    (field) => !ALLOWED_FIELDS.includes(field as AllowedField)
  );

  if (invalidFields.length > 0) {
    throw new Error(
      `[USER_CONSENTS_SCHEMA_VIOLATION] Invalid fields detected: ${invalidFields.join(", ")}. ` +
      `Allowed fields: ${ALLOWED_FIELDS.join(", ")}. ` +
      `Operation: ${operation}`
    );
  }

  // Type validation for insert
  if (operation === "insert") {
    if (typeof payload.user_id !== "string") {
      throw new Error("[USER_CONSENTS_SCHEMA_VIOLATION] user_id must be a string");
    }
    if (typeof payload.accepted_terms !== "boolean") {
      throw new Error("[USER_CONSENTS_SCHEMA_VIOLATION] accepted_terms must be a boolean");
    }
    if (
      payload.consented_at !== undefined &&
      typeof payload.consented_at !== "string"
    ) {
      throw new Error("[USER_CONSENTS_SCHEMA_VIOLATION] consented_at must be a string (ISO date)");
    }
  }

  // Log successful validation in development
  if (!Runtime.isBuild()) {
    console.log("[USER_CONSENTS] Payload validated", {
      fields: payloadFields,
      operation,
    });
  }
}

// Sanitizer - removes any unexpected fields (defense in depth)
export function sanitizeUserConsentsPayload<T extends Record<string, unknown>>(
  payload: T
): Pick<T, AllowedField> {
  const sanitized = {} as Pick<T, AllowedField>;
  for (const field of ALLOWED_FIELDS) {
    if (field in payload) {
      (sanitized as Record<string, unknown>)[field] = payload[field];
    }
  }
  return sanitized;
}

// Factory for creating valid insert payloads
export function createUserConsentsInsert(params: {
  userId: string;
  acceptedTerms: boolean;
  consentedAt?: Date | string;
}): UserConsentsInsert {
  const payload: UserConsentsInsert = {
    user_id: params.userId,
    accepted_terms: params.acceptedTerms,
    consented_at:
      params.consentedAt instanceof Date
        ? params.consentedAt.toISOString()
        : params.consentedAt ?? new Date().toISOString(),
  };

  // Validate before returning
  validateUserConsentsPayload(payload as unknown as Record<string, unknown>, "insert");
  return payload;
}

// Type guard for runtime checks
export function isValidUserConsentsRow(obj: unknown): obj is UserConsentsRow {
  if (typeof obj !== "object" || obj === null) return false;
  const row = obj as Record<string, unknown>;
  return (
    typeof row.user_id === "string" &&
    typeof row.accepted_terms === "boolean" &&
    typeof row.consented_at === "string"
  );
}
