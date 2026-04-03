"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  TURNSTILE_SITE_KEY_MISSING_MESSAGE,
  readPublicTurnstileSiteKey,
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

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const ADBLOCK_MESSAGE = "Tarayici eklentileri guvenlik dogrulamasini engelliyor olabilir";
const DOMAIN_MISMATCH_MESSAGE =
  "Turnstile bu domain icin dogrulanamadi. Localhost veya 127.0.0.1 adresini Cloudflare allowlist'e ekleyin.";
const isDevelopment = process.env.NODE_ENV === "development";

let turnstileScriptPromise: Promise<void> | null = null;

const debugTurnstile = (message: string, details?: Record<string, unknown>) => {
  if (!isDevelopment) {
    return;
  }

  console.debug(`[turnstile.widget] ${message}`, details);
};

const warnPossibleDomainMismatch = (details?: Record<string, unknown>) => {
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

    const handleReady = () => {
      if (window.turnstile) {
        if (existingScript) {
          existingScript.dataset.loaded = "true";
        }

        debugTurnstile("Script loaded.", { scriptLoaded: true });
        resolve();
        return;
      }

      turnstileScriptPromise = null;
      reject(new Error("Turnstile script loaded but window.turnstile is undefined."));
    };

    const handleError = () => {
      turnstileScriptPromise = null;
      reject(new Error("Turnstile script could not be loaded."));
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        handleReady();
        return;
      }

      existingScript.addEventListener("load", handleReady, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      handleReady();
    }, { once: true });
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
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [scriptFailed, setScriptFailed] = useState(false);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const containerId = useId().replaceAll(":", "");
  const resolvedSiteKey = siteKey?.trim() || readPublicTurnstileSiteKey().siteKey;

  useEffect(() => {
    debugTurnstile("Resolved site key.", {
      scriptLoaded: scriptReady,
      siteKey: resolvedSiteKey,
    });
  }, [resolvedSiteKey, scriptReady]);

  useEffect(() => {
    if (resolvedSiteKey) {
      return;
    }

    setRuntimeWarning(null);
    onWarningChange?.(null);
    onTokenChange(null);
    onStatusChange?.("unsupported");
  }, [onStatusChange, onTokenChange, onWarningChange, resolvedSiteKey]);

  useEffect(() => {
    if (!resolvedSiteKey) {
      return;
    }

    let cancelled = false;
    setScriptFailed(false);
    setRuntimeWarning(null);
    onWarningChange?.(null);

    void ensureTurnstileScript()
      .then(() => {
        if (cancelled) {
          return;
        }

        setScriptFailed(false);
        setScriptReady(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        onTokenChange(null);
        onStatusChange?.("error");
        setScriptReady(false);
        setScriptFailed(true);
        setRuntimeWarning(ADBLOCK_MESSAGE);
        onWarningChange?.(ADBLOCK_MESSAGE);
        console.error("[turnstile.widget] Script load failed.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [onStatusChange, onTokenChange, onWarningChange, resolvedSiteKey]);

  useEffect(() => {
    if (
      !scriptReady ||
      !resolvedSiteKey ||
      runtimeWarning ||
      !containerRef.current ||
      !window.turnstile ||
      widgetIdRef.current
    ) {
      return;
    }

    onTokenChange(null);
    onStatusChange?.("idle");
    widgetVerifiedRef.current = false;

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: resolvedSiteKey,
        theme,
        callback: (token) => {
          widgetVerifiedRef.current = true;
          onTokenChange(token);
          onStatusChange?.("verified");
        },
        "error-callback": (errorCode) => {
          const normalizedErrorCode = String(errorCode ?? "").trim();

          if (normalizedErrorCode === "110200") {
            setRuntimeWarning(DOMAIN_MISMATCH_MESSAGE);
            onWarningChange?.(DOMAIN_MISMATCH_MESSAGE);
            onTokenChange(null);
            onStatusChange?.("unsupported");
            return;
          }

          if (widgetRenderedRef.current && !widgetVerifiedRef.current) {
            warnPossibleDomainMismatch({
              errorCode,
              siteKey: resolvedSiteKey,
              widgetRendered: true,
            });
          }

          widgetVerifiedRef.current = false;
          onTokenChange(null);
          onStatusChange?.("error");
        },
        "expired-callback": () => {
          if (widgetRenderedRef.current && !widgetVerifiedRef.current) {
            warnPossibleDomainMismatch({
              reason: "expired",
              siteKey: resolvedSiteKey,
              widgetRendered: true,
            });
          }

          widgetVerifiedRef.current = false;
          onTokenChange(null);
          onStatusChange?.("expired");
        },
        "timeout-callback": () => {
          if (widgetRenderedRef.current && !widgetVerifiedRef.current) {
            warnPossibleDomainMismatch({
              reason: "timeout",
              siteKey: resolvedSiteKey,
              widgetRendered: true,
            });
          }

          widgetVerifiedRef.current = false;
          onTokenChange(null);
          onStatusChange?.("expired");
        },
      });

      widgetRenderedRef.current = true;
      debugTurnstile("Widget rendered.", {
        scriptLoaded: true,
        siteKey: resolvedSiteKey,
        widgetRendered: true,
      });
    } catch (error) {
      widgetRenderedRef.current = false;
      widgetIdRef.current = null;
      onTokenChange(null);
      onStatusChange?.("error");
      console.error("[turnstile.widget] Widget render failed.", error);
      return;
    }

    return () => {
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }

      widgetRenderedRef.current = false;
      widgetVerifiedRef.current = false;
      widgetIdRef.current = null;
    };
  }, [onStatusChange, onTokenChange, onWarningChange, resolvedSiteKey, runtimeWarning, scriptReady, theme]);

  useEffect(() => {
    if (!refreshNonce) {
      return;
    }

    widgetVerifiedRef.current = false;
    setRuntimeWarning(null);
    onWarningChange?.(null);
    onTokenChange(null);
    onStatusChange?.("idle");

    if (widgetIdRef.current && window.turnstile?.reset) {
      window.turnstile.reset(widgetIdRef.current);
      debugTurnstile("Widget reset.", {
        siteKey: resolvedSiteKey,
        widgetRendered: widgetRenderedRef.current,
      });
      return;
    }

    if (scriptReady) {
      setScriptReady(false);
      window.setTimeout(() => {
        setScriptReady(Boolean(window.turnstile));
      }, 0);
    }
  }, [onStatusChange, onTokenChange, onWarningChange, refreshNonce, resolvedSiteKey, scriptReady]);

  if (!resolvedSiteKey) {
    return (
      <p className="text-sm text-amber-200" role="alert">
        {TURNSTILE_SITE_KEY_MISSING_MESSAGE}
      </p>
    );
  }

  if (scriptFailed) {
    return (
      <p className="text-sm text-amber-200" role="alert">
        {ADBLOCK_MESSAGE}
      </p>
    );
  }

  if (runtimeWarning) {
    return (
      <p className="text-sm text-amber-200" role="alert">
        {runtimeWarning}
      </p>
    );
  }

  return (
    <div
      id={containerId}
      ref={containerRef}
      className="cf-turnstile relative z-10 min-h-[65px] pointer-events-auto"
      data-sitekey={resolvedSiteKey}
      data-theme={theme}
    />
  );
}
