import * as Sentry from "@sentry/nextjs";
import { getSentryInitOptions } from "@/lib/monitoring/sentry-runtime";

const CLIENT_INIT_FLAG = "__assetly_sentry_client_initialized__";

const globalClientState = globalThis as typeof globalThis & {
  [CLIENT_INIT_FLAG]?: boolean;
};

if (!globalClientState[CLIENT_INIT_FLAG]) {
  Sentry.init(getSentryInitOptions());
  globalClientState[CLIENT_INIT_FLAG] = true;
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
