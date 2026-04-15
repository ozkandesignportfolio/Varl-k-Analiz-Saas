/**
 * Database Error Handling Utilities
 *
 * Standardized error handling for Supabase operations.
 * Converts technical errors to user-friendly messages.
 *
 * Error Categories:
 * - 23505: Unique violation (duplicate key) - handled silently with upsert
 * - 42xxx: Syntax/undefined errors - schema issues
 * - PGRST: PostgREST errors - API level issues
 * - Network: Connection/timeout issues
 * - Auth: Authentication/authorization issues
 */

export type DbErrorCode =
  | "23505" // Unique violation
  | "23503" // Foreign key violation
  | "23502" // Not null violation
  | "42501" // Insufficient privilege
  | "42P01" // Undefined table
  | "42703" // Undefined column
  | "PGRST" // PostgREST error
  | "NETWORK" // Network/connection error
  | "TIMEOUT" // Query timeout
  | "UNKNOWN"; // Unknown error

export interface DbError {
  code: DbErrorCode;
  message: string;
  technicalMessage?: string;
  isRetryable: boolean;
}

/**
 * Parse Supabase/PostgreSQL error into standardized format
 */
export function parseDbError(error: unknown): DbError {
  // Default error
  const defaultError: DbError = {
    code: "UNKNOWN",
    message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
    technicalMessage: error instanceof Error ? error.message : String(error),
    isRetryable: false,
  };

  if (!error) {
    return defaultError;
  }

  // Handle Supabase error objects
  const supabaseError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  const code = supabaseError.code;
  const message = supabaseError.message || "";

  // Map known error codes
  switch (code) {
    case "23505":
      return {
        code: "23505",
        message: "Bu kayıt zaten mevcut.",
        technicalMessage: message,
        isRetryable: false,
      };

    case "23503":
      return {
        code: "23503",
        message: "İlişkili kayıt bulunamadı.",
        technicalMessage: message,
        isRetryable: false,
      };

    case "23502":
      return {
        code: "23502",
        message: "Zorunlu alanlar eksik.",
        technicalMessage: message,
        isRetryable: false,
      };

    case "42501":
      return {
        code: "42501",
        message: "Bu işlem için yetkiniz yok.",
        technicalMessage: message,
        isRetryable: false,
      };

    case "42P01":
      return {
        code: "42P01",
        message: "Sistem yapılandırma hatası. Lütfen destek ile iletişime geçin.",
        technicalMessage: message,
        isRetryable: false,
      };

    case "42703":
      return {
        code: "42703",
        message: "Sistem yapılandırma hatası. Lütfen destek ile iletişime geçin.",
        technicalMessage: message,
        isRetryable: false,
      };

    default:
      // Check for network/connection errors
      if (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("connection") ||
        message.includes("ECONNREFUSED")
      ) {
        return {
          code: "NETWORK",
          message: "Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.",
          technicalMessage: message,
          isRetryable: true,
        };
      }

      // Check for timeout
      if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
        return {
          code: "TIMEOUT",
          message: "İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.",
          technicalMessage: message,
          isRetryable: true,
        };
      }

      // Check for PostgREST errors
      if (code?.startsWith("PGRST")) {
        return {
          code: "PGRST",
          message: "API hatası. Lütfen tekrar deneyin.",
          technicalMessage: message,
          isRetryable: true,
        };
      }

      return defaultError;
  }
}

/**
 * Check if error is a duplicate key violation
 */
export function isDuplicateKeyError(error: unknown): boolean {
  const dbError = parseDbError(error);
  return dbError.code === "23505";
}

/**
 * Check if error is retryable (network/timeout)
 */
export function isRetryableError(error: unknown): boolean {
  const dbError = parseDbError(error);
  return dbError.isRetryable;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const dbError = parseDbError(error);
  return dbError.message;
}

/**
 * Log error with full technical details (internal use only)
 */
export function logDbError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const dbError = parseDbError(error);

  console.error(`[db-error] ${context}`, {
    code: dbError.code,
    userMessage: dbError.message,
    technicalMessage: dbError.technicalMessage,
    isRetryable: dbError.isRetryable,
    ...metadata,
  });
}

/**
 * Safe wrapper for upsert operations
 * Returns success even on duplicate key (idempotent behavior)
 */
export async function safeUpsert<T>(
  operation: () => Promise<{ error: unknown; data?: T }>,
  context: string
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const result = await operation();

    if (result.error) {
      const dbError = parseDbError(result.error);

      // Duplicate key is considered success (idempotent)
      if (dbError.code === "23505") {
        console.log(`[db-error] ${context} - duplicate ignored`, {
          context,
          code: dbError.code,
        });
        return { success: true };
      }

      logDbError(context, result.error);
      return { success: false, error: dbError.message };
    }

    return { success: true, data: result.data };
  } catch (error) {
    logDbError(context, error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}
