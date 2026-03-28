import "server-only";
import * as Sentry from "@sentry/nextjs";
import { getSentryEnabled, normalizeUnknownError } from "@/lib/monitoring/sentry-runtime";

const PROCESS_LISTENERS_FLAG = "__assetly_sentry_process_listeners_installed__";

export const installUnhandledProcessHandlers = () => {
  if (!getSentryEnabled()) {
    return;
  }

  const globalProcessState = globalThis as typeof globalThis & {
    [PROCESS_LISTENERS_FLAG]?: boolean;
  };

  if (globalProcessState[PROCESS_LISTENERS_FLAG]) {
    return;
  }

  globalProcessState[PROCESS_LISTENERS_FLAG] = true;

  process.on("uncaughtException", (error) => {
    Sentry.captureException(normalizeUnknownError(error), {
      tags: {
        unhandled: "uncaughtException",
      },
    });
    void Sentry.flush(2_000);
  });

  process.on("unhandledRejection", (reason) => {
    Sentry.captureException(normalizeUnknownError(reason), {
      tags: {
        unhandled: "unhandledRejection",
      },
    });
    void Sentry.flush(2_000);
  });
};

