import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logApiError, logApiRequest } from "@/lib/api/logging";
import { requireAdminRouteAccess } from "@/lib/auth/admin-access";
import { snapshotDlqSize } from "@/lib/telemetry/dlq-snapshot";
import { getTelemetrySnapshot } from "@/lib/telemetry/event-telemetry";
import {
  evaluateAndDispatchAlerts,
  getActiveAlerts,
  type Alert,
} from "@/lib/telemetry/alert-hooks";

export const dynamic = "force-dynamic";

/**
 * ADMIN TELEMETRY API
 * ============================================================================
 * GET  /api/admin/telemetry
 *   Returns counters, gauges (incl. latest DLQ snapshot), histograms, and
 *   currently active alerts. Existing admin dashboards can consume this JSON
 *   without any UI component changes.
 *
 * POST /api/admin/telemetry
 *   Re-samples DLQ size, re-evaluates alerts, and returns the fresh snapshot.
 *   Alert dispatch is fire-and-forget (webhook runs in background).
 * ============================================================================
 */

type TelemetryResponse = {
  snapshot: ReturnType<typeof getTelemetrySnapshot>;
  alerts: Alert[];
  dlqSize: number | null;
};

const buildResponse = async (refresh: boolean): Promise<TelemetryResponse> => {
  let dlqSize: number | null = null;
  if (refresh) {
    dlqSize = await snapshotDlqSize();
  }
  const alerts = refresh ? evaluateAndDispatchAlerts() : getActiveAlerts();
  const snapshot = getTelemetrySnapshot();

  if (!refresh) {
    const dlqGauge = snapshot.gauges.find((g) => g.name === "dlq_size_snapshot");
    dlqSize = dlqGauge?.value ?? null;
  }

  return { snapshot, alerts, dlqSize };
};

const runHandler = async (request: Request, method: "GET" | "POST") => {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const startedAt = Date.now();
  let responseStatus = 500;
  let userId: string | null = null;

  try {
    const auth = await requireAdminRouteAccess(request);
    if ("response" in auth) {
      responseStatus = auth.response.status;
      return auth.response;
    }
    userId = auth.accessMode === "user" ? auth.user.id : "admin-secret";

    const payload = await buildResponse(method === "POST");
    responseStatus = 200;
    return NextResponse.json<TelemetryResponse>(payload, { status: 200 });
  } catch (error) {
    logApiError({
      durationMs: Date.now() - startedAt,
      error,
      message: "Admin telemetry request failed.",
      method,
      requestId,
      route: "/api/admin/telemetry",
      status: 500,
      userId,
    });
    responseStatus = 500;
    return NextResponse.json({ error: "Failed to load telemetry." }, { status: 500 });
  } finally {
    logApiRequest({
      durationMs: Date.now() - startedAt,
      method,
      requestId,
      route: "/api/admin/telemetry",
      status: responseStatus,
      userId,
    });
  }
};

export async function GET(request: Request) {
  return runHandler(request, "GET");
}

export async function POST(request: Request) {
  return runHandler(request, "POST");
}
