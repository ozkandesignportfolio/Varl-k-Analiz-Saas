import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetTelemetryForTests,
  incrementCounter,
  requestFreshSnapshot,
} from "@/lib/telemetry/event-telemetry";
import { evaluateAlerts } from "@/lib/telemetry/alert-hooks";

test("alert cooldown suppresses duplicate firing within window", () => {
  __resetTelemetryForTests();
  incrementCounter("event_dispatch_failure_total", undefined, 10);
  incrementCounter("event_dispatch_success_total", undefined, 10);

  const snapshot = requestFreshSnapshot();
  const first = evaluateAlerts({ minDispatchVolume: 1, failureRateThreshold: 0.1, cooldownMs: 60_000 }, snapshot);
  const second = evaluateAlerts({ minDispatchVolume: 1, failureRateThreshold: 0.1, cooldownMs: 60_000 }, snapshot);

  assert.ok(first.length >= second.length);
});
