"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  resetTrigger?: number;
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
  tokenReceivedAt: number | null;
  usingTestKey: boolean;
  windowTurnstile: boolean;
};

type PreservedWidgetState = {
  cleanupTimer: number | null;
  parkingNode: HTMLDivElement;
  siteKey: string;
  theme: "auto" | "light" | "dark";
  widgetId: string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SCRIPT_LOAD_TIMEOUT_MS = 10_000;
const STRICT_MODE_PRESERVE_MS = 250;
const ADBLOCK_MESSAGE = "Tarayici eklentisi engelliyor olabilir";
const DOMAIN_MISMATCH_MESSAGE = TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
const RUNTIME_RESET_MESSAGE = "Dogrulama yenileniyor. Lutfen tekrar tamamlayin.";
const isDevelopment = process.env.NODE_ENV === "development";

let turnstileScriptPromise: Promise<void> | null = null;
let preservedWidgetState: PreservedWidgetState | null = null;

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

const clearPreservedWidgetCleanup = () => {
  if (!preservedWidgetState || preservedWidgetState.cleanupTimer === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(preservedWidgetState.cleanupTimer);
  preservedWidgetState.cleanupTimer = null;
};

const discardPreservedWidget = (reason: string) => {
  if (!preservedWidgetState) {
    return;
  }

  clearPreservedWidgetCleanup();

  if (window.turnstile?.remove) {
    try {
      window.turnstile.remove(preservedWidgetState.widgetId);
    } catch (error) {
      debugTurnstile("Preserved widget remove failed.", {
        error,
        reason,
        widgetId: preservedWidgetState.widgetId,
      });
    }
  }

  preservedWidgetState = null;
};

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
      <span className="text-slate-300">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

function TurnstileWidget({
  onStatusChange,
  onTokenChange,
  onWarningChange,
  resetTrigger = 0,
  siteKey,
  theme = "auto",
}: TurnstileWidgetProps) {
  if (isDevelopment) {
    console.count("TURNSTILE RENDER");
  }

  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const renderAttemptedRef = useRef(false);
  const callbacksRef = useRef({
    onStatusChange,
    onTokenChange,
    onWarningChange,
  });
  const renderWidgetRef = useRef<() => void>(() => undefined);
  const resolvedSiteKeyRef = useRef<string | null>(null);
  const themeRef = useRef<"auto" | "light" | "dark">(theme);
  const statusRef = useRef<TurnstileWidgetStatus>("idle");
  const tokenRef = useRef<string | null>(null);
  const warningRef = useRef<string | null>(null);
  const prevResetTriggerRef = useRef(resetTrigger);

  const hostname = typeof window !== "undefined" ? window.location.hostname : null;
  const configuredSiteKey = siteKey?.trim() || readPublicTurnstileSiteKey().siteKey;
  const resolvedSiteKey = resolveTurnstileSiteKeyForHostname({
    configuredSiteKey,
    hostname,
  });
  const isUsingTestKey = resolvedSiteKey === TURNSTILE_LOCALHOST_TEST_SITE_KEY;

  resolvedSiteKeyRef.current = resolvedSiteKey;
  themeRef.current = theme;
  callbacksRef.current = {
    onStatusChange,
    onTokenChange,
    onWarningChange,
  };

  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [scriptFailed, setScriptFailed] = useState(false);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const [debugState, setDebugState] = useState<TurnstileDebugState>(() => ({
    callbackTriggered: false,
    lastErrorCode: null,
    renderCalled: false,
    scriptLoaded: typeof window !== "undefined" && Boolean(window.turnstile),
    tokenReceivedAt: null,
    usingTestKey: isUsingTestKey,
    windowTurnstile: typeof window !== "undefined" && Boolean(window.turnstile),
  }));

  const updateDebugState = (patch: Partial<TurnstileDebugState>) => {
    setDebugState((current) => ({
      ...current,
      ...patch,
      usingTestKey: patch.usingTestKey ?? (resolvedSiteKeyRef.current === TURNSTILE_LOCALHOST_TEST_SITE_KEY),
      windowTurnstile: patch.windowTurnstile ?? (typeof window !== "undefined" && Boolean(window.turnstile)),
    }));
  };

  const emitStatus = (status: TurnstileWidgetStatus) => {
    if (statusRef.current === status) {
      return;
    }

    statusRef.current = status;
    callbacksRef.current.onStatusChange?.(status);
  };

  const emitToken = (token: string | null) => {
    if (tokenRef.current === token) {
      return;
    }

    tokenRef.current = token;
    callbacksRef.current.onTokenChange(token);
  };

  const emitWarning = (warning: string | null) => {
    if (warningRef.current === warning) {
      return;
    }

    warningRef.current = warning;
    setRuntimeWarning((current) => (current === warning ? current : warning));
    callbacksRef.current.onWarningChange?.(warning);
  };

  const destroyWidget = (reason: string) => {
    const widgetId = widgetIdRef.current;

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

    if (containerElementRef.current) {
      containerElementRef.current.innerHTML = "";
    }

    widgetIdRef.current = null;
    renderAttemptedRef.current = false;
  };

  const preserveWidgetForStrictMode = () => {
    if (!isDevelopment || typeof window === "undefined" || !containerElementRef.current || !widgetIdRef.current) {
      return false;
    }

    if (!containerElementRef.current.firstChild || !resolvedSiteKeyRef.current) {
      return false;
    }

    discardPreservedWidget("replace-preserved-widget");

    const parkingNode = document.createElement("div");

    while (containerElementRef.current.firstChild) {
      parkingNode.appendChild(containerElementRef.current.firstChild);
    }

    preservedWidgetState = {
      cleanupTimer: window.setTimeout(() => {
        discardPreservedWidget("strict-mode-timeout");
      }, STRICT_MODE_PRESERVE_MS),
      parkingNode,
      siteKey: resolvedSiteKeyRef.current,
      theme: themeRef.current,
      widgetId: widgetIdRef.current,
    };

    widgetIdRef.current = null;
    renderAttemptedRef.current = false;

    return true;
  };

  const restorePreservedWidget = () => {
    if (!preservedWidgetState || !containerElementRef.current || !resolvedSiteKeyRef.current) {
      return false;
    }

    if (
      preservedWidgetState.siteKey !== resolvedSiteKeyRef.current ||
      preservedWidgetState.theme !== themeRef.current
    ) {
      discardPreservedWidget("config-changed");
      return false;
    }

    clearPreservedWidgetCleanup();

    while (preservedWidgetState.parkingNode.firstChild) {
      containerElementRef.current.appendChild(preservedWidgetState.parkingNode.firstChild);
    }

    widgetIdRef.current = preservedWidgetState.widgetId;
    renderAttemptedRef.current = true;
    preservedWidgetState = null;
    updateDebugState({
      renderCalled: true,
      scriptLoaded: true,
      usingTestKey: resolvedSiteKeyRef.current === TURNSTILE_LOCALHOST_TEST_SITE_KEY,
      windowTurnstile: true,
    });
    debugTurnstile("Restored preserved widget after StrictMode remount.", {
      siteKey: resolvedSiteKeyRef.current,
      widgetId: widgetIdRef.current,
    });
    return true;
  };

  const resetWidget = (reason: string, nextStatus: Extract<TurnstileWidgetStatus, "expired" | "error">, nextWarning: string | null) => {
    const widgetId = widgetIdRef.current;

    emitToken(null);
    emitStatus(nextStatus);
    emitWarning(nextWarning);

    if (!widgetId || !window.turnstile?.reset) {
      return;
    }

    try {
      window.turnstile.reset(widgetId);
      debugTurnstile("Widget reset.", {
        reason,
        widgetId,
      });
    } catch (error) {
      debugTurnstile("Widget reset failed.", {
        error,
        reason,
        widgetId,
      });
    }
  };

  renderWidgetRef.current = () => {
    const activeSiteKey = resolvedSiteKeyRef.current;

    if (!containerElementRef.current || !window.turnstile || !activeSiteKey || widgetIdRef.current || renderAttemptedRef.current) {
      return;
    }

    if (restorePreservedWidget()) {
      return;
    }

    renderAttemptedRef.current = true;
    emitStatus("idle");
    emitWarning(null);

    try {
      widgetIdRef.current = window.turnstile.render(containerElementRef.current, {
        sitekey: activeSiteKey,
        theme: themeRef.current,
        callback: (token) => {
          emitWarning(null);
          emitToken(token);
          emitStatus("verified");
          updateDebugState({
            callbackTriggered: true,
            lastErrorCode: null,
            tokenReceivedAt: Date.now(),
          });
          debugTurnstile("Widget callback fired.", {
            tokenLength: token.length,
            tokenReceivedAt: Date.now(),
            widgetId: widgetIdRef.current,
          });
        },
        "error-callback": (errorCode) => {
          const normalizedErrorCode = String(errorCode ?? "").trim();

          emitToken(null);
          updateDebugState({
            callbackTriggered: false,
            lastErrorCode: normalizedErrorCode || "unknown",
          });

          if (normalizedErrorCode === "110200") {
            emitWarning(DOMAIN_MISMATCH_MESSAGE);
            emitStatus("unsupported");
            warnPossibleDomainMismatch({
              errorCode,
              siteKey: activeSiteKey,
              widgetRendered: true,
            });
            return;
          }

          warnPossibleDomainMismatch({
            errorCode,
            siteKey: activeSiteKey,
            widgetRendered: true,
          });
          resetWidget("error-callback", "error", RUNTIME_RESET_MESSAGE);
        },
        "expired-callback": () => {
          updateDebugState({
            callbackTriggered: false,
            lastErrorCode: "expired",
          });
          resetWidget("expired-callback", "expired", null);
        },
        "timeout-callback": () => {
          updateDebugState({
            callbackTriggered: false,
            lastErrorCode: "timeout",
          });
          resetWidget("timeout-callback", "expired", RUNTIME_RESET_MESSAGE);
        },
      });
      updateDebugState({
        renderCalled: true,
        scriptLoaded: true,
        usingTestKey: activeSiteKey === TURNSTILE_LOCALHOST_TEST_SITE_KEY,
        windowTurnstile: true,
      });
      debugTurnstile("Widget rendered.", {
        scriptLoaded: true,
        siteKey: activeSiteKey,
        widgetId: widgetIdRef.current,
      });
    } catch (error) {
      widgetIdRef.current = null;
      renderAttemptedRef.current = false;
      emitToken(null);
      emitStatus("error");
      emitWarning(RUNTIME_RESET_MESSAGE);
      updateDebugState({
        callbackTriggered: false,
        lastErrorCode: error instanceof Error ? error.message : "render_failed",
        renderCalled: false,
      });
      console.error("[turnstile.widget] Widget render failed.", error);
    }
  };

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerElementRef.current = node;

    if (node) {
      renderWidgetRef.current();
    }
  }, []);

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
    let cancelled = false;

    if (!resolvedSiteKeyRef.current) {
      emitToken(null);
      emitStatus("unsupported");
      emitWarning(null);
      updateDebugState({
        callbackTriggered: false,
        lastErrorCode: null,
        renderCalled: false,
        usingTestKey: false,
      });
      return () => {
        discardPreservedWidget("missing-site-key-cleanup");
      };
    }

    setScriptFailed(false);
    emitWarning(null);

    void ensureTurnstileScript()
      .then(() => {
        if (cancelled) {
          return;
        }

        setScriptReady(true);
        setScriptFailed(false);
        updateDebugState({
          scriptLoaded: true,
          windowTurnstile: true,
        });
        renderWidgetRef.current();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        emitToken(null);
        emitStatus("error");
        emitWarning(ADBLOCK_MESSAGE);
        setScriptReady(false);
        setScriptFailed(true);
        updateDebugState({
          lastErrorCode: error instanceof Error ? error.message : "script_load_failed",
          scriptLoaded: false,
          windowTurnstile: typeof window !== "undefined" && Boolean(window.turnstile),
        });
        console.error("[turnstile.widget] Script load failed.", error);
      });

    return () => {
      cancelled = true;

      if (preserveWidgetForStrictMode()) {
        return;
      }

      destroyWidget("component-unmount");
      discardPreservedWidget("component-unmount");
    };
  }, []);

  useEffect(() => {
    if (prevResetTriggerRef.current === resetTrigger) {
      return;
    }
    prevResetTriggerRef.current = resetTrigger;

    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile?.reset) {
      return;
    }

    emitToken(null);
    emitStatus("idle");
    emitWarning(null);

    try {
      window.turnstile.reset(widgetId);
      debugTurnstile("Widget reset via resetTrigger.", { resetTrigger, widgetId });
    } catch (error) {
      debugTurnstile("Widget reset via resetTrigger failed.", { error, resetTrigger, widgetId });
    }
  }, [resetTrigger]);

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
          ref={setContainerRef}
          className={`cf-turnstile relative z-[999] min-h-[65px] !pointer-events-auto ${
            resolvedSiteKey && !scriptFailed ? "" : "hidden"
          }`}
          data-theme={theme}
        />
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
            <DebugLine label="token alindi" value={debugState.tokenReceivedAt ? new Date(debugState.tokenReceivedAt).toLocaleTimeString() : "-"} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default React.memo(TurnstileWidget);
