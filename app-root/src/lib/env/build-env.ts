// CRITICAL: Use direct dot-notation so webpack DefinePlugin can inline the
// values at build time. Dynamic bracket access (process.env[key]) is NOT
// replaced and evaluates to undefined in the client bundle.
const safeBuildEnv = (value: string | undefined): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
};

export const BuildEnv = Object.freeze({
  NODE_ENV: safeBuildEnv(process.env.NODE_ENV),
  NEXT_PHASE: safeBuildEnv(process.env.NEXT_PHASE),
  NEXT_RUNTIME: safeBuildEnv(process.env.NEXT_RUNTIME),
});

export type BuildEnvKeys = keyof typeof BuildEnv;

export const isProductionNodeEnv = (): boolean => BuildEnv.NODE_ENV === "production";

export const isDevelopmentNodeEnv = (): boolean => BuildEnv.NODE_ENV === "development";
