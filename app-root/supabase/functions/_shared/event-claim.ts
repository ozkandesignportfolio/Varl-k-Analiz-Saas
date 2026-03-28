import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";
import type { AutomationEvent } from "./notification.ts";
import type { EventActionResult } from "./action-runner.ts";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveBatchSize(batchSizeInput: unknown): number {
  return clamp(Number(batchSizeInput ?? 20), 1, 100);
}

export async function claimAutomationEvents(
  supabase: SupabaseClient,
  batchSize: number,
): Promise<AutomationEvent[]> {
  const { data, error } = await supabase.rpc("claim_automation_events", { p_limit: batchSize });
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AutomationEvent[];
}

export async function updateEventAfterActions(
  supabase: SupabaseClient,
  eventId: string,
  result: EventActionResult,
): Promise<"completed" | "failed"> {
  const status = result.ok ? "completed" : "failed";
  const lastError = result.ok ? null : JSON.stringify(result.results);

  const { error } = await supabase
    .from("automation_events")
    .update({
      status,
      action_results: result.results,
      processed_at: new Date().toISOString(),
      last_error: lastError,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  return status;
}

export async function markEventAsFailed(
  supabase: SupabaseClient,
  eventId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("automation_events")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      last_error: errorMessage,
    })
    .eq("id", eventId);
}
