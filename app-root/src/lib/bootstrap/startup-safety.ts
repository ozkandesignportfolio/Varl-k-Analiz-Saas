import "server-only";

import { BuildEnv } from "@/lib/env/build-env";
import { Runtime } from "@/lib/env/runtime";
import { validateCriticalEnv } from "@/lib/env/server-env";
import { createTelemetryRegistry, requestFreshSnapshot } from "@/lib/telemetry/event-telemetry";

const assertRuntimeSanity = () => {
  const isClient = Runtime.isClient();
  const isServer = Runtime.isServer();
  const isEdge = Runtime.isEdge();
  const isBuild = Runtime.isBuild();

  if (isClient) {
    throw new Error("[startup-safety] Invalid runtime: bootstrap executed on client.");
  }

  if (isEdge && isServer) {
    throw new Error("[startup-safety] Invalid runtime: edge and server both true.");
  }

  if (BuildEnv.NEXT_RUNTIME === "nodejs" && !isBuild && !isServer) {
    throw new Error("[startup-safety] Invalid runtime: expected node server runtime.");
  }
};

const assertTelemetryBootstrap = () => {
  const registry = createTelemetryRegistry();
  if (!registry || registry.__sealed !== true) {
    throw new Error("[startup-safety] Telemetry registry initialization failed.");
  }

  const snapshot = requestFreshSnapshot();
  if (!snapshot || snapshot.snapshotTimestamp <= 0) {
    throw new Error("[startup-safety] Telemetry snapshot initialization failed.");
  }
};

export const assertStartupSafety = () => {
  validateCriticalEnv();
  assertRuntimeSanity();
  assertTelemetryBootstrap();
};
