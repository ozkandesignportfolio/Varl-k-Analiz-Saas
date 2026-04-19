"use client";

import { useEffect, useRef, useState } from "react";
import { Runtime } from "@/lib/env/runtime";

const deferStateUpdate = (callback: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }

  setTimeout(callback, 0);
};

export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const current = ref.current;
    if (!current) {
      return;
    }

    if (!Runtime.isClient() || !window.IntersectionObserver) {
      deferStateUpdate(() => {
        setInView(true);
      });
      return;
    }

    // Synchronously flip to inView if the element is already within the
    // viewport on mount. Some Chromium (desktop + Android) builds do not
    // emit an initial isIntersecting=true callback for above-the-fold
    // elements until the first scroll, leaving animated sections stuck at
    // opacity-0. iOS Safari does not show the issue because it fires the
    // initial observer entry eagerly.
    const rect = current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const alreadyVisible =
      rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;

    if (alreadyVisible) {
      deferStateUpdate(() => {
        setInView(true);
      });
      return;
    }

    try {
      const observer = new window.IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        },
        { threshold }
      );

      observer.observe(current);

      return () => {
        observer.disconnect();
      };
    } catch {
      deferStateUpdate(() => {
        setInView(true);
      });
      return;
    }
  }, [threshold]);

  return { ref, inView };
}
