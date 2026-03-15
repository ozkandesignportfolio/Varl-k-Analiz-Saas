import "server-only";
import * as Sentry from "@sentry/nextjs";
import { installUnhandledProcessHandlers } from "@/lib/monitoring/sentry-process-handlers";
import { getSentryInitOptions } from "@/lib/monitoring/sentry-runtime";

const SERVER_INIT_FLAG = "__assetly_sentry_server_initialized__";

export const initSentryServer = () => {
  const globalServerState = globalThis as typeof globalThis & {
    [SERVER_INIT_FLAG]?: boolean;
  };

  if (!globalServerState[SERVER_INIT_FLAG]) {
    Sentry.init(getSentryInitOptions());
    globalServerState[SERVER_INIT_FLAG] = true;
  }

  installUnhandledProcessHandlers();
};
