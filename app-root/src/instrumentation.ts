import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      assertTurnstileServerEnv,
      logTurnstileEnvDebug,
    } = await import("./lib/env/turnstile-server");

    assertTurnstileServerEnv("instrumentation");
    logTurnstileEnvDebug("instrumentation");

    const { initSentryServer } = await import("./sentry.server.config");
    initSentryServer();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { initSentryEdge } = await import("./sentry.edge.config");
    initSentryEdge();
  }
}

export const onRequestError = Sentry.captureRequestError;
