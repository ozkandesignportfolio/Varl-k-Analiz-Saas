import * as Sentry from "@sentry/nextjs";

/**
 * Next.js runtime instrumentation.
 *
 * Sözleşme:
 *  - Bu fonksiyon ASLA throw etmez. Env eksik/geçersizse yalnızca structured
 *    `console.error({ context, missingEnv })` üretir; server boot'u kesmez.
 *  - `process.env` okumaları sadece `NEXT_RUNTIME` branch seçimi içindir;
 *    uygulama env'leri `@/lib/env/server-env` üzerinden doğrulanır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getConfigIssues } = await import("./lib/env/runtime-env");
      const { logTurnstileEnvDebug } = await import(
        "./lib/env/turnstile-server"
      );

      const missingEnv = getConfigIssues();
      if (missingEnv.length > 0) {
        console.error({
          level: "error",
          context: "instrumentation",
          message: "Server env validation failed",
          missingEnv,
        });
      }

      logTurnstileEnvDebug("instrumentation");
    } catch (error) {
      console.error({
        level: "error",
        context: "instrumentation",
        message: "Instrumentation bootstrap failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const { initSentryServer } = await import("./sentry.server.config");
      initSentryServer();
    } catch (error) {
      console.error({
        level: "error",
        context: "instrumentation.sentry.server",
        message: "Sentry server init failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    try {
      const { initSentryEdge } = await import("./sentry.edge.config");
      initSentryEdge();
    } catch (error) {
      console.error({
        level: "error",
        context: "instrumentation.sentry.edge",
        message: "Sentry edge init failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
