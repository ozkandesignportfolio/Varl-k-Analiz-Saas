"use client";

import { useEffect, useRef, useState } from "react";
import {
  TURNSTILE_DOMAIN_INACTIVE_MESSAGE,
  TURNSTILE_LOCALHOST_TEST_SITE_KEY,
  TURNSTILE_SITE_KEY_MISSING_MESSAGE,
  readPublicTurnstileSiteKey,
  resolveTurnstileSiteKeyForHostname,
} from "@/lib/env/turnstile";

type TurnstileWidgetProps = {
  onStatusChange?: (status: TurnstileWidgetStatus) => void;
  onTokenChange: (token: string | null) => void;
  onWarningChange?: (warning: string | null) => void;
  refreshNonce?: number;
  siteKey?: string | null;
  theme?: "auto" | "light" | "dark";
};

export type TurnstileWidgetStatus = "idle" | "verified" | "expired" | "error" | "unsupported";

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "auto" | "light" | "dark";
  callback?: (token: string) => void;
  "error-callback"?: (errorCode?: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  reset?: (widgetId?: string) => void;
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
  remove?: (widgetId: string) => void;
};

type TurnstileDebugState = {
  callbackTriggered: boolean;
  lastErrorCode: string | null;
  renderCalled: boolean;
  scriptLoaded: boolean;
  usingTestKey: boolean;
  windowTurnstile: boolean;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SCRIPT_LOAD_TIMEOUT_MS = 10_000;
const TURNSTILE_RERENDER_DELAY_MS = 350;
const ADBLOCK_MESSAGE = "Tarayıcı eklentisi engelliyor olabilir";
const DOMAIN_MISMATCH_MESSAGE = TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
const HARD_RESET_MESSAGE = "Doğrulama takıldı, widget yeniden yükleniyor.";
const isDevelopment = process.env.NODE_ENV === "development";

let turnstileScriptPromise: Promise<void> | null = null;

const debugTurnstile = (message: string, details?: Record<string, unknown>) => {
  if (!isDevelopment) {
    return;
  }

  console.debug(`[turnstile.widget] ${message}`, details);
};

const warnPossibleDomainMismatch = (details?: Record<string, unknown>) => {
  if (!isDevelopment) {
    return;
  }

  console.warn("Turnstile domain mismatch olabilir", details);
};

const createTurnstileScriptPromise = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Turnstile script can only load in the browser."));
      return;
    }

    if (window.turnstile) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    const handleReady = () => {
      if (window.turnstile) {
        script.dataset.loaded = "true";
        cleanup();
        debugTurnstile("Script loaded.", { scriptLoaded: true });
        resolve();
        return;
      }

      cleanup();
      turnstileScriptPromise = null;
      reject(new Error("Turnstile script loaded but window.turnstile is undefined."));
    };

    const handleLoad = () => {
      handleReady();
    };

    const handleError = () => {
      cleanup();
      turnstileScriptPromise = null;
      reject(new Error(ADBLOCK_MESSAGE));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      turnstileScriptPromise = null;
      reject(new Error("Turnstile script load timed out."));
    }, TURNSTILE_SCRIPT_LOAD_TIMEOUT_MS);

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        handleReady();
        return;
      }

      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

const ensureTurnstileScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile script can only load in the browser."));
  }

  if (window.turnstile) {
    debugTurnstile("Script already available on window.", { scriptLoaded: true });
    return Promise.resolve();
  }

  if (!turnstileScriptPromise) {
    debugTurnstile("Injecting Turnstile script.", { scriptLoaded: false });
    turnstileScriptPromise = createTurnstileScriptPromise();
  }

  return turnstileScriptPromise;
};

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
      <span className="text-slate-300">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export default function TurnstileWidget({
  onStatusChange,
  onTokenChange,
  onWarningChange,
  refreshNonce = 0,
  siteKey,
  theme = "auto",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const widgetRenderedRef = useRef(false);
  const widgetVerifiedRef = useRef(false);
  const scheduledRerenderRef = useRef<number | null>(null);
  const callbacksRef = useRef({
    onStatusChange,
    onTokenChange,
    onWarningChange,
  });
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [scriptFailed, setScriptFailed] = useState(false);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const hostname = typeof window !== "undefined" ? window.location.hostname : null;
  const configuredSiteKey = siteKey?.trim() || readPublicTurnstileSiteKey().siteKey;
  const resolvedSiteKey = resolveTurnstileSiteKeyForHostname({
    configuredSiteKey,
    hostname,
  });
  const isUsingTestKey = resolvedSiteKey === TURNSTILE_LOCALHOST_TEST_SITE_KEY;
  const [debugState, setDebugState] = useState<TurnstileDebugState>(() => ({
    callbackTriggered: false,
    lastErrorCode: null,
    renderCalled: false,
    scriptLoaded: typeof window !== "undefined" && Boolean(window.turnstile),
    usingTestKey: isUsingTestKey,
    windowTurnstile: typeof window !== "undefined" && Boolean(window.turnstile),
  }));

  const updateDebugState = (patch: Partial<TurnstileDebugState>) => {
    setDebugState((current) => ({
      ...current,
      ...patch,
      usingTestKey: patch.usingTestKey ?? isUsingTestKey,
      windowTurnstile: patch.windowTurnstile ?? (typeof window !== "undefined" && Boolean(window.turnstile)),
    }));
  };

  const emitStatus = (status: TurnstileWidgetStatus) => {
    callbacksRef.current.onStatusChange?.(status);
  };

  const emitToken = (token: string | null) => {
    callbacksRef.current.onTokenChange(token);
  };

  const emitWarning = (warning: string | null) => {
    callbacksRef.current.onWarningChange?.(warning);
  };

  const clearScheduledRerender = () => {
    if (scheduledRerenderRef.current === null || typeof window === "undefined") {
      return;
    }

    window.clearTimeout(scheduledRerenderRef.current);
    scheduledRerenderRef.current = null;
  };

  const destroyWidget = (reason: string, options?: { resetFirst?: boolean }) => {
    clearScheduledRerender();

    const widgetId = widgetIdRef.current;

    if (widgetId && options?.resetFirst && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetId);
      } catch (error) {
        debugTurnstile("Widget reset before remove failed.", {
          error,
          reason,
          widgetId,
        });
      }
    }

    if (widgetId && window.turnstile?.remove) {
      try {
        window.turnstile.remove(widgetId);
      } catch (error) {
        debugTurnstile("Widget remove failed.", {
          error,
          reason,
          widgetId,
        });
      }
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    widgetIdRef.current = null;
    widgetRenderedRef.current = false;
    widgetVerifiedRef.current = false;
  };

  const scheduleHardReset = (reason: string, warningMessage: string | null) => {
    const widgetId = widgetIdRef.current;

    widgetVerifiedRef.current = false;
    emitToken(null);
    emitStatus("idle");
    setRuntimeWarning(warningMessage);
    emitWarning(warningMessage);

    if (widgetId && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetId);
        debugTurnstile("Widget reset.", {
          reason,
          siteKey: resolvedSiteKey,
          widgetId,
        });
      } catch (error) {
        debugTurnstile("Widget reset failed.", {
          error,
          reason,
          widgetId,
        });
      }
    }

    clearScheduledRerender();

    if (typeof window === "undefined") {
      return;
    }

    scheduledRerenderRef.current = window.setTimeout(() => {
      destroyWidget(`${reason}:rerender`);
      setRuntimeWarning(null);
      emitWarning(null);
      updateDebugState({
        callbackTriggered: false,
        lastErrorCode: null,
        renderCalled: false,
      });
      setRenderNonce((current) => current + 1);
    }, TURNSTILE_RERENDER_DELAY_MS);
  };

  useEffect(() => {
    callbacksRef.current = {
      onStatusChange,
      onTokenChange,
      onWarningChange,
    };
  }, [onStatusChange, onTokenChange, onWarningChange]);

  useEffect(() => {
    updateDebugState({
      scriptLoaded: scriptReady,
      usingTestKey: isUsingTestKey,
      windowTurnstile: typeof window !== "undefined" && Boolean(window.turnstile),
    });

    debugTurnstile("Resolved site key.", {
      scriptLoaded: scriptReady,
      siteKey: resolvedSiteKey,
      usingTestKey: isUsingTestKey,
    });
  }, [isUsingTestKey, resolvedSiteKey, scriptReady]);

  useEffect(() => {
    return () => {
      destroyWidget("component-unmount", { resetFirst: true });
    };
  }, []);

  useEffect(() => {
    if (resolvedSiteKey) {
      return;
    }

    setRuntimeWarning(null);
    emitWarning(null);
    emitToken(null);
    emitStatus("unsupported");
    updateDebugState({
      callbackTriggered: false,
      lastErrorCode: null,
      renderCalled: false,
      usingTestKey: false,
    });
  }, [resolvedSiteKey]);

  useEffect(() => {
    if (!resolvedSiteKey) {
      return;
    }

    let cancelled = false;

    setScriptFailed(false);
    setRuntimeWarning(null);
    emitWarning(null);

    void ensureTurnstileScript()
      .then(() => {
        if (cancelled) {
          return;
        }

        setScriptFailed(false);
        setScriptReady(true);
        updateDebugState({
          scriptLoaded: true,
          windowTurnstile: true,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        emitToken(null);
        emitStatus("error");
        setScriptReady(false);
        setScriptFailed(true);
        setRuntimeWarning(ADBLOCK_MESSAGE);
        emitWarning(ADBLOCK_MESSAGE);
        updateDebugState({
          lastErrorCode: error instanceof Error ? error.message : "script_load_failed",
          scriptLoaded: false,
          windowTurnstile: typeof window !== "undefined" && Boolean(window.turnstile),
        });
        console.error("[turnstile.widget] Script load failed.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSiteKey]);

  useEffect(() => {
    if (!scriptReady || !resolvedSiteKey || scriptFailed || !containerRef.current || !window.turnstile) {
      return;
    }

    destroyWidget("pre-render", { resetFirst: true });

    emitToken(null);
    emitStatus("idle");
    emitWarning(null);
    setRuntimeWarning(null);
    updateDebugState({
      callbackTriggered: false,
      lastErrorCode: null,
      renderCalled: false,
      scriptLoaded: true,
      windowTurnstile: true,
    });

    try {
      updateDebugState({ renderCalled: true });

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: resolvedSiteKey,
        theme,
        callback: (token) => {
          widgetVerifiedRef.current = true;
          setRuntimeWarning(null);
          emitWarning(null);
          emitToken(token);
          emitStatus("verified");
          updateDebugState({
            callbackTriggered: true,
            lastErrorCode: null,
          });
          debugTurnstile("Widget callback fired.", {
            tokenLength: token.length,
            widgetId: widgetIdRef.current,
          });
        },
        "error-callback": (errorCode) => {
          const normalizedErrorCode = String(errorCode ?? "").trim();

          widgetVerifiedRef.current = false;
          emitToken(null);
          updateDebugState({
            callbackTriggered: false,
            lastErrorCode: normalizedErrorCode || "unknown",
          });

          if (normalizedErrorCode === "110200") {
            setRuntimeWarning(DOMAIN_MISMATCH_MESSAGE);
            emitWarning(DOMAIN_MISMATCH_MESSAGE);
            emitStatus("unsupported");
            return;
          }

          if (widgetRenderedRef.current && !widgetVerifiedRef.current) {
            warnPossibleDomainMismatch({
              errorCode,
              siteKey: resolvedSiteKey,
              widgetRendered: true,
            });
          }

          emitStatus("error");
          scheduleHardReset("error-callback", HARD_RESET_MESSAGE);
        },
        "expired-callback": () => {
          widgetVerifiedRef.current = false;
          emitToken(null);
          emitStatus("expired");
          updateDebugState({
            callbackTriggered: false,
            lastErrorCode: "expired",
          });
          scheduleHardReset("expired-callback", null);
        },
        "timeout-callback": () => {
          widgetVerifiedRef.current = false;
          emitToken(null);
          emitStatus("expired");
          updateDebugState({
            callbackTriggered: false,
            lastErrorCode: "timeout",
          });

          if (widgetRenderedRef.current && !widgetVerifiedRef.current) {
            warnPossibleDomainMismatch({
              reason: "timeout",
              siteKey: resolvedSiteKey,
              widgetRendered: true,
            });
          }

          scheduleHardReset("timeout-callback", HARD_RESET_MESSAGE);
        },
      });

      widgetRenderedRef.current = true;
      debugTurnstile("Widget rendered.", {
        scriptLoaded: true,
        siteKey: resolvedSiteKey,
        widgetRendered: true,
        widgetId: widgetIdRef.current,
      });
    } catch (error) {
      widgetRenderedRef.current = false;
      widgetIdRef.current = null;
      emitToken(null);
      emitStatus("error");
      updateDebugState({
        callbackTriggered: false,
        lastErrorCode: error instanceof Error ? error.message : "render_failed",
      });
      console.error("[turnstile.widget] Widget render failed.", error);
      scheduleHardReset("render-failed", HARD_RESET_MESSAGE);
      return;
    }

    return () => {
      destroyWidget("effect-cleanup", { resetFirst: true });
    };
  }, [renderNonce, resolvedSiteKey, scriptFailed, scriptReady, theme]);

  useEffect(() => {
    if (!refreshNonce) {
      return;
    }

    scheduleHardReset("external-refresh", null);
  }, [refreshNonce]);

  const handleManualRefresh = () => {
    scheduleHardReset("manual-refresh", null);
  };

  const displayWarning = resolvedSiteKey
    ? runtimeWarning ?? (scriptFailed ? ADBLOCK_MESSAGE : null)
    : TURNSTILE_SITE_KEY_MISSING_MESSAGE;

  return (
    <div className="space-y-3">
      {displayWarning ? (
        <p className="text-sm text-amber-200" role="alert">
          {displayWarning}
        </p>
      ) : null}

      <div className="relative z-[999] !pointer-events-auto">
        <div
          ref={containerRef}
          className={`cf-turnstile relative z-[999] min-h-[65px] !pointer-events-auto ${
            resolvedSiteKey && !scriptFailed ? "" : "hidden"
          }`}
          data-theme={theme}
        />
      </div>

      <div className={`flex flex-wrap items-center gap-3 ${isDevelopment ? "justify-between" : "justify-end"}`}>
        {isDevelopment ? (
          <p className="text-xs text-slate-400">
            {isUsingTestKey ? "Localhost test key aktif." : "Cloudflare Turnstile explicit render aktif."}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleManualRefresh}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-100 transition hover:border-sky-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!resolvedSiteKey}
        >
          Doğrulamayı Yenile
        </button>
      </div>

      {isDevelopment ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
          <p className="font-semibold text-slate-100">Turnstile Debug</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DebugLine label="window.turnstile" value={debugState.windowTurnstile ? "Var" : "Yok"} />
            <DebugLine label="script loaded" value={debugState.scriptLoaded ? "Evet" : "Hayir"} />
            <DebugLine label="render cagrildi" value={debugState.renderCalled ? "Evet" : "Hayir"} />
            <DebugLine label="callback tetiklendi" value={debugState.callbackTriggered ? "Evet" : "Hayir"} />
            <DebugLine label="site key modu" value={debugState.usingTestKey ? "Test key" : "Env key"} />
            <DebugLine label="son hata" value={debugState.lastErrorCode ?? "-"} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
