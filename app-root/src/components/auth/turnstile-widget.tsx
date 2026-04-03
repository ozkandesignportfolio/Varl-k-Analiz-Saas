"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";

type TurnstileWidgetProps = {
  onTokenChange: (token: string | null) => void;
  refreshNonce?: number;
  siteKey: string;
  theme?: "auto" | "light" | "dark";
};

type TurnstileRenderOptions = {
  sitekey: string;
  theme?: "auto" | "light" | "dark";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
  remove?: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function TurnstileWidget({
  onTokenChange,
  refreshNonce = 0,
  siteKey,
  theme = "dark",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerId = useId().replaceAll(":", "");

  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    onTokenChange(null);

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      callback: (token) => onTokenChange(token),
      "error-callback": () => onTokenChange(null),
      "expired-callback": () => onTokenChange(null),
      "timeout-callback": () => onTokenChange(null),
    });

    return () => {
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
      widgetIdRef.current = null;
    };
  }, [onTokenChange, refreshNonce, scriptReady, siteKey, theme]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div id={containerId} ref={containerRef} />
    </>
  );
}
