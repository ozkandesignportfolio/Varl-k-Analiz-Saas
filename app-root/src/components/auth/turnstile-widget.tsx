"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import {
  TURNSTILE_SITE_KEY_MISSING_MESSAGE,
  readPublicTurnstileSiteKey,
} from "@/lib/env/turnstile";

type TurnstileWidgetProps = {
  onStatusChange?: (status: TurnstileWidgetStatus) => void;
  onTokenChange: (token: string | null) => void;
  refreshNonce?: number;
  siteKey?: string | null;
  theme?: "auto" | "light" | "dark";
};

export type TurnstileWidgetStatus = "idle" | "verified" | "expired" | "error" | "unsupported";

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "auto" | "light" | "dark";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
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

export default function TurnstileWidget({
  onStatusChange,
  onTokenChange,
  refreshNonce = 0,
  siteKey,
  theme = "auto",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [scriptFailed, setScriptFailed] = useState(false);
  const containerId = useId().replaceAll(":", "");
  const resolvedSiteKey = siteKey?.trim() || readPublicTurnstileSiteKey().siteKey;

  useEffect(() => {
    if (resolvedSiteKey) {
      return;
    }

    onTokenChange(null);
    onStatusChange?.("unsupported");
  }, [onStatusChange, onTokenChange, resolvedSiteKey]);

  useEffect(() => {
    if (!scriptReady || !resolvedSiteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    onTokenChange(null);
    onStatusChange?.("idle");

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: resolvedSiteKey,
      theme,
      callback: (token) => {
        onTokenChange(token);
        onStatusChange?.("verified");
      },
      "error-callback": () => {
        onTokenChange(null);
        onStatusChange?.("error");
      },
      "expired-callback": () => {
        onTokenChange(null);
        onStatusChange?.("expired");
      },
      "timeout-callback": () => {
        onTokenChange(null);
        onStatusChange?.("expired");
      },
    });

    return () => {
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
      widgetIdRef.current = null;
    };
  }, [onStatusChange, onTokenChange, refreshNonce, resolvedSiteKey, scriptReady, theme]);

  useEffect(() => {
    if (!refreshNonce) {
      return;
    }

    onTokenChange(null);
    onStatusChange?.("idle");

    if (widgetIdRef.current && window.turnstile?.reset) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [onStatusChange, onTokenChange, refreshNonce]);

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
        Bot korumasi yuklenemedi. Lutfen sayfayi yenileyip tekrar deneyin.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptFailed(false);
          setScriptReady(true);
        }}
        onError={() => {
          onTokenChange(null);
          onStatusChange?.("error");
          setScriptFailed(true);
          setScriptReady(false);
        }}
      />
      <div id={containerId} ref={containerRef} />
    </>
  );
}
