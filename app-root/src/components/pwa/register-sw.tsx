"use client";

import { useEffect } from "react";
import { Runtime } from "@/lib/env/runtime";

type IdleCallbackHandle = number;

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadline) => void,
    options?: { timeout: number },
  ) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
};

const getSessionStorageSafely = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function PwaRegister() {
  useEffect(() => {
    if (!Runtime.isClient() || typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    const idleWindow = window as WindowWithIdleCallback;
    const sessionStorageRef = getSessionStorageSafely();
    const devCleanupReloadKey = "__assetcare_dev_sw_cleanup_reload__";

    if (!Runtime.isBuild()) {
      const cleanupDevServiceWorkers = async () => {
        try {
          const hadController = Boolean(navigator.serviceWorker.controller);
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const cacheKeys = await caches.keys();
            const appCacheKeys = cacheKeys.filter(
              (key) => key.startsWith("assetcare-shell-") || key.startsWith("assetly-static-"),
            );
            await Promise.all(appCacheKeys.map((key) => caches.delete(key)));
          }

          if (hadController) {
            const hasReloaded = sessionStorageRef?.getItem(devCleanupReloadKey) === "1";
            if (!hasReloaded) {
              sessionStorageRef?.setItem(devCleanupReloadKey, "1");
              window.location.reload();
              return;
            }
          }

          sessionStorageRef?.removeItem(devCleanupReloadKey);
        } catch {
          // Geliştirme ortamında cleanup başarısız olsa da uygulama normal çalışmaya devam eder.
        }
      };

      void cleanupDevServiceWorkers();
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Service worker kaydı başarısız olursa uygulama normal web modunda çalışmaya devam eder.
      }
    };

    const onLoad = () => {
      if (idleWindow.requestIdleCallback) {
        const idleHandle = idleWindow.requestIdleCallback(
          () => {
            void register();
          },
          { timeout: 1200 },
        );

        return () => {
          idleWindow.cancelIdleCallback?.(idleHandle);
        };
      }

      const timeoutHandle = window.setTimeout(() => {
        void register();
      }, 1);

      return () => {
        window.clearTimeout(timeoutHandle);
      };
    };

    if (document.readyState === "complete") {
      return onLoad();
    }

    let cancelDeferredRegister: (() => void) | undefined;
    const handleLoad = () => {
      cancelDeferredRegister = onLoad();
    };

    window.addEventListener("load", handleLoad, { once: true });

    return () => {
      window.removeEventListener("load", handleLoad);
      cancelDeferredRegister?.();
    };
  }, []);

  return null;
}
