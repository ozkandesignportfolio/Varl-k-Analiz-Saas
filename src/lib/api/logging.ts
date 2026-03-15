import "server-only";
import { captureApiException } from "@/lib/monitoring/sentry-server";

type ApiErrorLogParams = {
  route: string;
  method: string;
  error: unknown;
  userId?: string | null;
  requestId?: string | null;
  status?: number;
  durationMs?: number | null;
  dbTimeMs?: number | null;
  openAiTimeMs?: number | null;
  message?: string;
  meta?: Record<string, unknown>;
};

type ApiRequestLogParams = {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  userId?: string | null;
  requestId?: string | null;
  dbTimeMs?: number | null;
  openAiTimeMs?: number | null;
  meta?: Record<string, unknown>;
};

type CoreEntityType = "assets" | "maintenance_rules" | "service_logs" | "documents" | "asset_media";
type AuditAction = "create" | "update" | "delete";

type AuditLogParams = {
  entityType: CoreEntityType;
  action: AuditAction;
  entityId: string;
  userId: string;
  route: string;
  meta?: Record<string, unknown>;
};

type LogLevel = "info" | "error";

const getErrorPayload = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ? error.stack.split("\n").slice(0, 3).join("\n") : undefined,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: "Unknown error", detail: error };
};

const writeStructuredLog = (level: LogLevel, payload: Record<string, unknown>) => {
  const stream = level === "error" ? process.stderr : process.stdout;

  try {
    stream.write(`${JSON.stringify({ level, ...payload })}\n`);
  } catch {
    stream.write(
      `${JSON.stringify({
        level: "error",
        summary: "Failed to serialize log payload",
      })}\n`,
    );
  }
};

export function logApiError(params: ApiErrorLogParams) {
  const { error, message, method, meta, route, status, userId, requestId, durationMs, dbTimeMs, openAiTimeMs } =
    params;

  captureApiException({
    route,
    method,
    error,
    status,
    message,
    requestId,
    userId,
    meta,
  });

  writeStructuredLog("error", {
    event: "api:error",
    ts: new Date().toISOString(),
    requestId: requestId ?? null,
    route,
    method,
    userId: userId ?? null,
    status: status ?? 500,
    duration_ms: durationMs ?? null,
    db_time_ms: dbTimeMs ?? null,
    openai_time_ms: openAiTimeMs ?? null,
    summary: message ?? "Unhandled API error",
    error: getErrorPayload(error),
    meta: meta ?? {},
  });
}

export function logApiRequest(params: ApiRequestLogParams) {
  const { route, method, status, durationMs, userId, requestId, dbTimeMs, openAiTimeMs, meta } = params;
  writeStructuredLog("info", {
    event: "api:request",
    ts: new Date().toISOString(),
    requestId: requestId ?? null,
    route,
    method,
    userId: userId ?? null,
    status,
    duration_ms: Math.max(0, Math.round(durationMs)),
    db_time_ms: dbTimeMs ?? null,
    openai_time_ms: openAiTimeMs ?? null,
    meta: meta ?? {},
  });
}

export function logAuditEvent(params: AuditLogParams) {
  const { action, entityId, entityType, meta, route, userId } = params;
  writeStructuredLog("info", {
    event: "api:audit",
    ts: new Date().toISOString(),
    route,
    userId,
    entityType,
    entityId,
    action,
    meta: meta ?? {},
  });
}
