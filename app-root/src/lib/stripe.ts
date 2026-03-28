import "server-only";

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? null;
const nodeEnv = process.env.NODE_ENV?.trim() ?? "development";
const allowLiveInNonProd = process.env.STRIPE_ALLOW_LIVE_IN_NON_PROD?.trim() === "true";

const resolveStripeSecretKeyValidationError = (key: string | null): string | null => {
  if (!key) {
    return null;
  }

  if (nodeEnv === "production" && key.startsWith("sk_test_")) {
    return "Invalid STRIPE_SECRET_KEY for production: test key (sk_test_) is not allowed.";
  }

  if (nodeEnv !== "production" && key.startsWith("sk_live_") && !allowLiveInNonProd) {
    return "Invalid STRIPE_SECRET_KEY for non-production: live key (sk_live_) is blocked. Use a test key (sk_test_) or set STRIPE_ALLOW_LIVE_IN_NON_PROD=true intentionally.";
  }

  return null;
};

const stripeSecretKeyValidationError = resolveStripeSecretKeyValidationError(stripeSecretKey);

export const getStripeSecretKeyValidationError = () => stripeSecretKeyValidationError;

export const stripe =
  stripeSecretKey && !stripeSecretKeyValidationError
    ? new Stripe(stripeSecretKey, {
        apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
      })
    : null;
