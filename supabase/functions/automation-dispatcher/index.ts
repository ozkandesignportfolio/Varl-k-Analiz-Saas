import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { runEventActions } from "../_shared/action-runner.ts";
import {
  claimAutomationEvents,
  markEventAsFailed,
  resolveBatchSize,
  updateEventAfterActions,
} from "../_shared/event-claim.ts";
import type { AutomationEvent } from "../_shared/notification.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function resolveDueWindow(input: unknown): string {
  const value = String(input ?? "").trim();
  return value || "1 day";
}

function resolveEmitDueEvents(input: unknown): boolean {
  if (typeof input === "boolean") return input;
  if (typeof input === "number") return input !== 0;
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return true;
    return !["0", "false", "no", "off"].includes(normalized);
  }
  return true;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Only POST is allowed." }, 405);
  }

  if (!cronSecret) {
    return json({ error: "AUTOMATION_CRON_SECRET is not configured." }, 503);
  }

  const providedCronSecret = request.headers.get("x-cron-secret");
  if (!providedCronSecret) {
    return json({ error: "Missing x-cron-secret." }, 401);
  }

  if (providedCronSecret !== cronSecret) {
    return json({ error: "Invalid x-cron-secret." }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const batchSize = resolveBatchSize(body.batch_size);
  const dueWindow = resolveDueWindow(body.due_window);
  const shouldEmitDueEvents = resolveEmitDueEvents(body.emit_due_events);

  let dueEventSummary: Record<string, number> | null = null;
  if (shouldEmitDueEvents) {
    const { data: dueData, error: dueError } = await supabase.rpc("emit_due_automation_events", {
      p_run_at: new Date().toISOString(),
      p_window: dueWindow,
    });

    if (dueError) {
      return json({ error: dueError.message }, 500);
    }

    if (dueData && typeof dueData === "object" && !Array.isArray(dueData)) {
      const asMap = dueData as Record<string, unknown>;
      dueEventSummary = Object.fromEntries(
        Object.entries(asMap).map(([key, value]) => [key, Number(value ?? 0)]),
      );
    }
  }

  let events: AutomationEvent[];
  try {
    events = await claimAutomationEvents(supabase, batchSize);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }

  const summary = {
    due_scan: dueEventSummary,
    claimed: events.length,
    completed: 0,
    failed: 0,
  };

  for (const event of events) {
    try {
      const result = await runEventActions(supabase, event);
      const status = await updateEventAfterActions(supabase, event.id, result);

      if (status === "completed") {
        summary.completed += 1;
      } else {
        summary.failed += 1;
      }
    } catch (error) {
      summary.failed += 1;
      await markEventAsFailed(supabase, event.id, error instanceof Error ? error.message : "unknown_error");
    }
  }

  return json(summary);
});
