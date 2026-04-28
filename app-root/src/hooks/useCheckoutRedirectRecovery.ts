"use client";

import { useEffect, useRef } from "react";

const REDIRECT_TIMEOUT_MS = 10_000;

export type CheckoutRecoveryReason = "bfcache" | "timeout";

/**
 * Stripe checkout redirect ile UI'nin "Yönlendiriliyor..." durumunda kilitlenmesini
 * önler. Kullanıcı tarayıcı geri tuşuyla geri döndüğünde veya redirect 10 saniyede
 * tetiklenmediğinde loading state'i sıfırlar.
 *
 * - "bfcache" : sayfa back/forward cache'ten geri yüklendi (pageshow.persisted=true).
 * - "timeout" : redirect 10 sn içinde gerçekleşmedi (güvenlik ağı).
 */
export function useCheckoutRedirectRecovery(
  isRedirecting: boolean,
  reset: (reason: CheckoutRecoveryReason) => void,
): void {
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    if (!isRedirecting || typeof window === "undefined") {
      return;
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetRef.current("bfcache");
      }
    };

    const timeoutId = window.setTimeout(() => {
      resetRef.current("timeout");
    }, REDIRECT_TIMEOUT_MS);

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [isRedirecting]);
}
