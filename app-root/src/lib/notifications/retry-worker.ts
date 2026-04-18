import "server-only";

import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logApiError } from "@/lib/api/logging";

/**
 * NOTIFICATION RETRY WORKER (Production-Grade)
 * ============================================================================
 * Outbox pattern'da kalan orphan event'leri tespit edip idempotent retry eder.
 * 
 * Kısıtlar:
 *   - Sadece SQL fonksiyonlarını çağırır (mevcut dispatch flow'u değiştirmez)
 *   - Idempotent: notification zaten varsa yeni oluşturmaz
 *   - Race-safe: concurrent execution'da duplicate oluşturmaz
 * 
 * SQL Dependencies:
 *   - v_outbox_incomplete: orphan detection view
 *   - retry_missing_notification(): idempotent retry function
 *   - rehydrate_missing_notification(): orphan repair function
 *   - v_dead_letter_monitor: DLQ monitoring
 *   - is_dead_letter_eligible_for_retry(): policy check
 *   - increment_dead_letter_retry(): counter update
 * ============================================================================
 */

const SERVICE_TAG = "[retry-worker]";

const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(`${SERVICE_TAG} ${event}`, payload);
};

// Retry policy: max concurrent batches
const MAX_BATCH_SIZE = 50;

// Outbox incomplete row from DB view
type OutboxIncompleteRow = {
  event_id: string;
  user_id: string;
  event_type: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown> | null;
  event_created_at: string;
  run_after: string | null;
  asset_name: string | null;
  action_href: string | null;
  email_only: string | null;
};

// Dead letter monitoring row
type DeadLetterMonitorRow = {
  id: string;
  user_id: string | null;
  event_type: string | null;
  dedupe_key: string | null;
  stage: string;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  last_retried_at: string | null;
  retry_status: "ELIGIBLE" | "BACKOFF" | "EXHAUSTED";
};

/**
 * Retry worker ana fonksiyonu.
 * Cron/scheduler tarafından belirli aralıklarla çağrılır.
 */
export const runRetryWorker = async (
  adminClient: SupabaseClient = getSupabaseAdmin()
): Promise<{
  processed: number;
  repaired: number;
  failed: number;
  deadLetterRetried: number;
}> => {
  const startedAt = Date.now();
  const stats = { processed: 0, repaired: 0, failed: 0, deadLetterRetried: 0 };

  logEvent("WORKER_START", { maxBatchSize: MAX_BATCH_SIZE });

  // 1) Outbox incomplete candidates al
  const { data: candidates, error: fetchError } = await adminClient
    .from("v_outbox_incomplete")
    .select("*")
    .limit(MAX_BATCH_SIZE)
    .returns<OutboxIncompleteRow[]>();

  if (fetchError) {
    logApiError({
      route: "/worker/retry",
      method: "POST",
      error: fetchError,
      status: 500,
      message: "Failed to fetch outbox incomplete candidates",
    });
    return stats;
  }

  if (!candidates || candidates.length === 0) {
    logEvent("WORKER_NO_CANDIDATES", {});
  } else {
    logEvent("WORKER_CANDIDATES", { count: candidates.length });

    // 2) Her candidate için idempotent retry
    for (const candidate of candidates) {
      stats.processed++;

      try {
        const { data: result, error: retryError } = await adminClient.rpc(
          "rehydrate_missing_notification",
          { p_event_id: candidate.event_id }
        );

        if (retryError) {
          logEvent("RETRY_FAILED", {
            eventId: candidate.event_id,
            error: retryError.message,
          });
          stats.failed++;
          continue;
        }

        // result: { notification_id, repaired, message }
        const resultRow = Array.isArray(result) ? result[0] : result;
        
        if (resultRow?.repaired) {
          logEvent("RETRY_SUCCESS", {
            eventId: candidate.event_id,
            notificationId: resultRow.notification_id,
          });
          stats.repaired++;
        } else {
          logEvent("RETRY_IDEMPOTENT", {
            eventId: candidate.event_id,
            notificationId: resultRow?.notification_id,
            message: resultRow?.message,
          });
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        logEvent("RETRY_EXCEPTION", {
          eventId: candidate.event_id,
          error: errorMsg,
        });
        stats.failed++;
      }
    }
  }

  // 3) Dead letter retry (ELIGIBLE olanlar)
  const { data: eligibleDeadLetters, error: dlError } = await adminClient
    .from("v_dead_letter_monitor")
    .select("*")
    .eq("retry_status", "ELIGIBLE")
    .limit(10)
    .returns<DeadLetterMonitorRow[]>();

  if (!dlError && eligibleDeadLetters && eligibleDeadLetters.length > 0) {
    logEvent("DL_RETRY_CANDIDATES", { count: eligibleDeadLetters.length });

    for (const dl of eligibleDeadLetters) {
      try {
        // Dead letter retry için özel logic buraya eklenebilir
        // Şu an sadece counter artırıyoruz (placeholder)
        await adminClient.rpc("increment_dead_letter_retry", {
          p_dead_letter_id: dl.id,
          p_error_message: null,
        });

        stats.deadLetterRetried++;
        logEvent("DL_RETRY_ATTEMPT", {
          deadLetterId: dl.id,
          attempt: dl.attempt_count + 1,
        });
      } catch (e) {
        logEvent("DL_RETRY_FAILED", {
          deadLetterId: dl.id,
          error: e instanceof Error ? e.message : "Unknown",
        });
      }
    }
  }

  const latencyMs = Date.now() - startedAt;
  logEvent("WORKER_COMPLETE", {
    ...stats,
    latencyMs,
  });

  // Structured log for log aggregator
  console.log(
    JSON.stringify({
      event: "retry:outcome",
      processed: stats.processed,
      repaired: stats.repaired,
      failed: stats.failed,
      deadLetterRetried: stats.deadLetterRetried,
      latencyMs,
      outcome:
        stats.failed === 0 && stats.repaired > 0
          ? "success"
          : stats.failed > 0
          ? "partial"
          : "noop",
    })
  );

  return stats;
};

/**
 * Manual orphan repair (admin/operator kullanımı için).
 * Belirli bir event_id için notification'ı idempotent oluşturur.
 */
export const manualRepairOrphan = async (
  eventId: string,
  adminClient: SupabaseClient = getSupabaseAdmin()
): Promise<{
  ok: boolean;
  notificationId?: string;
  message: string;
}> => {
  try {
    const { data: result, error } = await adminClient.rpc(
      "rehydrate_missing_notification",
      { p_event_id: eventId }
    );

    if (error) {
      return { ok: false, message: `Repair failed: ${error.message}` };
    }

    const resultRow = Array.isArray(result) ? result[0] : result;
    return {
      ok: true,
      notificationId: resultRow?.notification_id,
      message: resultRow?.message || "Repair completed",
    };
  } catch (e) {
    return {
      ok: false,
      message: `Exception: ${e instanceof Error ? e.message : "Unknown"}`,
    };
  }
};
