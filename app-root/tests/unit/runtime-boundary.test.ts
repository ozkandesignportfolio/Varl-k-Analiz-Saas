import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeFlags } from "@/lib/env/runtime";

test("runtime boundary resolves client runtime", () => {
  const flags = resolveRuntimeFlags({ hasWindow: true, hasEdgeRuntime: false, nextPhase: "" });
  assert.equal(flags.isClient, true);
  assert.equal(flags.isServer, false);
  assert.equal(flags.isBuild, false);
});

test("runtime boundary resolves build phase", () => {
  const flags = resolveRuntimeFlags({
    hasWindow: false,
    hasEdgeRuntime: false,
    nextPhase: "phase-production-build",
  });

  assert.equal(flags.isBuild, true);
  assert.equal(flags.isServer, false);
});

test("runtime boundary resolves edge runtime", () => {
  const flags = resolveRuntimeFlags({ hasWindow: false, hasEdgeRuntime: true, nextPhase: "" });
  assert.equal(flags.isEdge, true);
});
