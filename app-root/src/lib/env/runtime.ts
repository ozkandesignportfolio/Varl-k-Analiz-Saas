declare const EdgeRuntime: string | undefined;

export type RuntimeFlagInput = {
  hasWindow: boolean;
  hasEdgeRuntime: boolean;
  nextPhase: string;
};

export const resolveRuntimeFlags = (input: RuntimeFlagInput) => {
  const isBuild = input.nextPhase === "phase-production-build";
  const isClient = input.hasWindow;
  const isEdge = input.hasEdgeRuntime;
  const isServer = !isClient && !isBuild;

  return {
    isBuild,
    isClient,
    isEdge,
    isServer,
  } as const;
};

export const Runtime = Object.freeze({
  isClient: (): boolean =>
    resolveRuntimeFlags({
      hasWindow: typeof window !== "undefined",
      hasEdgeRuntime: typeof EdgeRuntime !== "undefined",
      nextPhase: typeof process !== "undefined" ? (process.env.NEXT_PHASE ?? "") : "",
    }).isClient,
  isServer: (): boolean =>
    resolveRuntimeFlags({
      hasWindow: typeof window !== "undefined",
      hasEdgeRuntime: typeof EdgeRuntime !== "undefined",
      nextPhase: typeof process !== "undefined" ? (process.env.NEXT_PHASE ?? "") : "",
    }).isServer,
  isBuild: (): boolean =>
    resolveRuntimeFlags({
      hasWindow: typeof window !== "undefined",
      hasEdgeRuntime: typeof EdgeRuntime !== "undefined",
      nextPhase: typeof process !== "undefined" ? (process.env.NEXT_PHASE ?? "") : "",
    }).isBuild,
  isEdge: (): boolean =>
    resolveRuntimeFlags({
      hasWindow: typeof window !== "undefined",
      hasEdgeRuntime: typeof EdgeRuntime !== "undefined",
      nextPhase: typeof process !== "undefined" ? (process.env.NEXT_PHASE ?? "") : "",
    }).isEdge,
});
