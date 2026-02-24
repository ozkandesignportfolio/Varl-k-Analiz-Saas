import "server-only";

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia" as unknown as Stripe.LatestApiVersion,
    })
  : null;
