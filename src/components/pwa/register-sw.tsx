"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const devCleanupReloadKey = "__assetcare_dev_sw_cleanup_reload__";

    if (process.env.NODE_ENV !== "production") {
      const cleanupDevServiceWorkers = async () => {
        try {
          const hadController = Boolean(navigator.serviceWorker.controller);
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const cacheKeys = await caches.keys();
            const appCacheKeys = cacheKeys.filter((key) => key.startsWith("assetcare-shell-"));
            await Promise.all(appCacheKeys.map((key) => caches.delete(key)));
          }

          if (hadController) {
            const hasReloaded = sessionStorage.getItem(devCleanupReloadKey) === "1";
            if (!hasReloaded) {
              sessionStorage.setItem(devCleanupReloadKey, "1");
              window.location.reload();
              return;
            }
          }
          sessionStorage.removeItem(devCleanupReloadKey);
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

    void register();
  }, []);

  return null;
}
