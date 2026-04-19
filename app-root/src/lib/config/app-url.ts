import { getAppUrl, requireAppUrl } from "@/lib/env/public-env";
import { PublicEnv } from "@/lib/env/public-env";

const PRODUCTION_CANONICAL_HOST = "www.assetly.network";
const PRODUCTION_HOST_ALIASES = new Set([PRODUCTION_CANONICAL_HOST, "assetly.network"]);

const canonicalize = (origin: string | null) => {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (PRODUCTION_HOST_ALIASES.has(url.hostname)) {
      url.protocol = "https:";
      url.hostname = PRODUCTION_CANONICAL_HOST;
      url.port = "";
    }
    return url.origin;
  } catch {
    return null;
  }
};

const normalizeConfiguredUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return canonicalize(new URL(trimmed).origin);
  } catch {
    return null;
  }
};

/**
 * Returns the configured origin or `null`. Preserves the existing contract
 * that `APP_URL` and `NEXT_PUBLIC_APP_URL` must agree when both are set.
 */
export const resolveConfiguredAppOrigin = () => {
  return normalizeConfiguredUrl(PublicEnv.NEXT_PUBLIC_APP_URL);
};

/**
 * Runtime-strict accessor. Delegates to the shared `requireAppUrl()`
 * helper — it returns a safe localhost fallback during `next build` /
 * SSR prerender so static export never crashes, and throws only when
 * truly running a real request with missing env.
 */
export const requireConfiguredAppOrigin = () => {
  return canonicalize(requireAppUrl()) ?? requireAppUrl();
};

/**
 * Build-safe accessor — always returns a usable origin (never throws).
 * Useful for non-critical paths where falling back to localhost is
 * preferable to a runtime crash.
 */
export const getConfiguredAppOrigin = () => {
  return canonicalize(getAppUrl()) ?? getAppUrl();
};
