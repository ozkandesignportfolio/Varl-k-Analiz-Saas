import assert from "node:assert/strict";
import test from "node:test";

import { __resetDlqCacheForTests, getCachedDlqSize, incrementDlqDelta } from "@/lib/telemetry/dlq-snapshot";

test("dlq cache reset isolates state across runs", () => {
  __resetDlqCacheForTests();
  incrementDlqDelta(3);

  const beforeReset = getCachedDlqSize();
  __resetDlqCacheForTests();
  const afterReset = getCachedDlqSize();

  assert.equal(beforeReset, null);
  assert.equal(afterReset, null);
});
