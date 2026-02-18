import "server-only";

type ApiErrorLogParams = {
  route: string;
  method: string;
  error: unknown;
  userId?: string | null;
  status?: number;
  message?: string;
  meta?: Record<string, unknown>;
};

type CoreEntityType = "assets" | "maintenance_rules" | "service_logs" | "documents";
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
  const { error, message, method, meta, route, status, userId } = params;
  writeStructuredLog("error", {
    event: "api:error",
    ts: new Date().toISOString(),
    route,
    method,
    userId: userId ?? null,
    status: status ?? 500,
    summary: message ?? "Unhandled API error",
    error: getErrorPayload(error),
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
