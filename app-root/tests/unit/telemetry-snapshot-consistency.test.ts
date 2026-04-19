import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetTelemetryForTests,
  incrementCounter,
  requestFreshSnapshot,
} from "@/lib/telemetry/event-telemetry";

test("telemetry snapshot version is monotonic", () => {
  __resetTelemetryForTests();

  const s1 = requestFreshSnapshot();
  incrementCounter("test_counter", undefined, 1);
  const s2 = requestFreshSnapshot();
  const s3 = requestFreshSnapshot();

  assert.ok(s2.snapshotVersion >= s1.snapshotVersion);
  assert.ok(s3.snapshotVersion >= s2.snapshotVersion);
});
