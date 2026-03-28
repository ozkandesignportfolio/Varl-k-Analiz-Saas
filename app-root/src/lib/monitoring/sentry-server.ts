import "server-only";
import * as Sentry from "@sentry/nextjs";
import { getSentryEnabled, normalizeUnknownError } from "@/lib/monitoring/sentry-runtime";
import { sanitizeSentryData } from "@/lib/monitoring/sentry-scrubber";

type CaptureApiExceptionParams = {
  route: string;
  method: string;
  error: unknown;
  status?: number;
  requestId?: string | null;
  userId?: string | null;
  message?: string;
  meta?: Record<string, unknown>;
};

export const captureApiException = ({
  route,
  method,
  error,
  status,
  requestId,
  userId,
  message,
  meta,
}: CaptureApiExceptionParams) => {
  if (!getSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("area", "api");
    scope.setTag("route", route);
    scope.setTag("method", method);

    if (typeof status === "number") {
      scope.setTag("status", String(status));
    }

    if (requestId) {
      scope.setTag("request_id", requestId);
    }

    if (userId) {
      scope.setUser({ id: userId });
    }

    if (message) {
      scope.setContext("api_error", {
        summary: message,
      });
    }

    scope.setContext(
      "api_meta",
      (sanitizeSentryData({
        request_id: requestId ?? null,
        route,
        method,
        status: status ?? 500,
        meta: meta ?? {},
      }) as Record<string, unknown>) ?? {},
    );

    Sentry.captureException(normalizeUnknownError(error));
  });
};

