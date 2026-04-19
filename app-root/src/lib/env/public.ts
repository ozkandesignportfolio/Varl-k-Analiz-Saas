import { PublicEnv } from "@/lib/env/public-env";
import { Runtime } from "@/lib/env/runtime";

/**
 * Public environment variable accessor for the browser bundle.
 *
 * Only `NEXT_PUBLIC_*` values are readable here — these get inlined into the
 * client bundle at build time by Next.js. If they are missing we DO NOT throw
 * eagerly: a lot of call sites (e.g. `PlanProvider` inside `useMemo`) run
 * during SSR/prerender. Crashing the render kills `next build` for static
 * pages like `/billing/cancel` even though the value is never actually
 * consumed on the server.
 *
 * Expected load order (Next.js):
 *   1. `.env.production` / `.env.development` (committed defaults)
 *   2. `.env.local` (local overrides, gitignored)
 *   3. Vercel "Environment Variables" (production/preview)
 */

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
  /** Both URL and anon key are non-empty. */
  isConfigured: boolean;
};

export const getPublicSupabaseEnv = (): PublicSupabaseEnv => {
  const url = PublicEnv.NEXT_PUBLIC_SUPABASE_URL.trim();
  const anonKey = PublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();

  return {
    url,
    anonKey,
    isConfigured: url.length > 0 && anonKey.length > 0,
  };
};

/**
 * Strict variant — use only in code paths that genuinely cannot proceed
 * without Supabase (runtime browser calls, API routes, etc.). Never call
 * this at module top-level or during SSR render, or you will break the
 * static build on environments that intentionally omit the vars.
 */
export const assertPublicSupabaseEnv = (): { url: string; anonKey: string } => {
  const { url, anonKey, isConfigured } = getPublicSupabaseEnv();
  if (!isConfigured) {
    throw new Error(
      "[Assetly] Missing Supabase public env vars. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (local) or in your Vercel project environment variables (preview/production).",
    );
  }
  return { url, anonKey };
};

/** True only while Next.js is running the production build/prerender phase. */
export const isBuildPhase = (): boolean => {
  return Runtime.isBuild();
};
