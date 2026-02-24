"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      const cleanupDevServiceWorkers = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const cacheKeys = await caches.keys();
            const appCacheKeys = cacheKeys.filter((key) => key.startsWith("assetcare-shell-"));
            await Promise.all(appCacheKeys.map((key) => caches.delete(key)));
          }
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

