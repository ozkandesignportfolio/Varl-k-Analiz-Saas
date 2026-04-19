const readBuildEnv = (key: "NODE_ENV" | "NEXT_PHASE" | "NEXT_RUNTIME"): string => {
  if (typeof process === "undefined") {
    return "";
  }

  const raw = process.env[key];
  if (typeof raw !== "string") {
    return "";
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : "";
};

export const BuildEnv = Object.freeze({
  NODE_ENV: readBuildEnv("NODE_ENV"),
  NEXT_PHASE: readBuildEnv("NEXT_PHASE"),
  NEXT_RUNTIME: readBuildEnv("NEXT_RUNTIME"),
});

export type BuildEnvKeys = keyof typeof BuildEnv;

export const isProductionNodeEnv = (): boolean => BuildEnv.NODE_ENV === "production";

export const isDevelopmentNodeEnv = (): boolean => BuildEnv.NODE_ENV === "development";
