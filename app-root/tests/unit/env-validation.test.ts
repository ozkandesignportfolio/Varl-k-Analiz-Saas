import assert from "node:assert/strict";
import test from "node:test";

import { validateServerEnvPayloadForTests } from "@/lib/env/server-env";

test("env validation rejects invalid payload deterministically", () => {
  const invalid = validateServerEnvPayloadForTests({
    SUPABASE_SERVICE_ROLE_KEY: "",
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    STRIPE_SECRET_KEY: "invalid",
    STRIPE_WEBHOOK_SECRET: "",
    TURNSTILE_SECRET_KEY: "",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    NODE_ENV: "production",
  });

  assert.equal(invalid.success, false);
});

test("env validation accepts minimum valid payload", () => {
  const valid = validateServerEnvPayloadForTests({
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    TURNSTILE_SECRET_KEY: "secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site",
    NODE_ENV: "development",
  });

  assert.equal(valid.success, true);
});
