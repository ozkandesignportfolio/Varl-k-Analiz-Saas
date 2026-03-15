import * as Sentry from "@sentry/nextjs";
import { getSentryInitOptions } from "@/lib/monitoring/sentry-runtime";

const EDGE_INIT_FLAG = "__assetly_sentry_edge_initialized__";

export const initSentryEdge = () => {
  const globalEdgeState = globalThis as typeof globalThis & {
    [EDGE_INIT_FLAG]?: boolean;
  };

  if (globalEdgeState[EDGE_INIT_FLAG]) {
    return;
  }

  Sentry.init(getSentryInitOptions());
  globalEdgeState[EDGE_INIT_FLAG] = true;
};
