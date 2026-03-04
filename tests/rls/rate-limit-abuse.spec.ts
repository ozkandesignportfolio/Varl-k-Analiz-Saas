import { expect, test } from "@playwright/test";
import { enforceRateLimit } from "@/lib/api/rate-limit";

test("rate limiter blocks burst abuse attempts", async () => {
  const scope = `abuse_test_${Date.now()}`;
  const key = "user-under-test";

  const first = enforceRateLimit({ scope, key, limit: 2, windowMs: 60_000 });
  const second = enforceRateLimit({ scope, key, limit: 2, windowMs: 60_000 });
  const third = enforceRateLimit({ scope, key, limit: 2, windowMs: 60_000 });

  expect(first.allowed).toBeTruthy();
  expect(second.allowed).toBeTruthy();
  expect(third.allowed).toBeFalsy();
  expect(third.retryAfterMs).toBeGreaterThan(0);
});
