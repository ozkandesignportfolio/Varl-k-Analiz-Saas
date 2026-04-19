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
  const runtimeFlag = process.env.NEXT_RUNTIME;
  const phaseFlag = process.env.NEXT_PHASE;
  const isNodeRuntime = runtimeFlag === "nodejs";
  const isEdgeRuntime = runtimeFlag === "edge";
  const isBuildPhase = phaseFlag === "phase-production-build";

  if (isNodeRuntime) {
    if (!isBuildPhase) {
      const { assertStartupSafety } = await import("./lib/bootstrap/startup-safety");
      assertStartupSafety();
    }

    try {
      const { getServerEnvIssues } = await import("./lib/env/server-env");
      const { logTurnstileEnvDebug } = await import(
        "./lib/env/turnstile-server"
      );

      const missingEnv = getServerEnvIssues();
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

  if (isEdgeRuntime) {
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
