import "server-only";

import Stripe from "stripe";
import { getConfig } from "@/lib/env/runtime-env";

/**
 * Stripe singleton accessor.
 *
 *  - Never null. Geçersiz CONFIG veya iş kuralı ihlalinde THROW eder.
 *  - İlk `getStripeClient()` çağrısında init edilir, sonrası O(1) cache.
 *  - Ek `process.env` okuması YOK; tüm operasyonel flag'lar CONFIG'den.
 */

let CLIENT: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (CLIENT) {
    return CLIENT;
  }

  const config = getConfig();
  const key = config.STRIPE_SECRET_KEY;

  if (config.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    throw new Error(
      "Invalid STRIPE_SECRET_KEY for production: test key (sk_test_) is not allowed.",
    );
  }

  if (
    config.NODE_ENV !== "production" &&
    key.startsWith("sk_live_") &&
    !config.STRIPE_ALLOW_LIVE_IN_NON_PROD
  ) {
    throw new Error(
      "Invalid STRIPE_SECRET_KEY for non-production: live key (sk_live_) is blocked. Use a test key (sk_test_) or set STRIPE_ALLOW_LIVE_IN_NON_PROD=true intentionally.",
    );
  }

  CLIENT = new Stripe(key, {
    apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
  });
  return CLIENT;
};
