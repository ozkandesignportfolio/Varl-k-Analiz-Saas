import "client-only";
import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/env/public";
import { Runtime } from "@/lib/env/runtime";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | undefined;
let hasLoggedMissingEnvWarning = false;

/**
 * Chainable no-op stub for SSR prerender when Supabase env vars are
 * missing. The real browser client is only ever exercised inside
 * `useEffect` handlers (which do not run during prerender), but many hooks
 * touch the client synchronously during render — e.g.
 * `useRef<ReturnType<typeof supabase.channel>>` type-only references or
 * destructured methods. Returning a Proxy that:
 *   - returns itself for any property access (so `supabase.from(..).select(..)` keeps chaining)
 *   - resolves awaited calls to `{ data: null, error }` instead of throwing
 * lets `next build` complete the static export on environments where the
 * vars are intentionally absent. In the browser we throw eagerly so the
 * misconfiguration is impossible to miss.
 */
const createDeferredErrorClient = (): BrowserClient => {
  const buildError = () =>
    new Error(
      "[Assetly] Supabase browser client invoked but NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured. Set them in .env.local for local development or in the Vercel project environment variables for preview/production.",
    );

  type Stub = {
    (...args: unknown[]): unknown;
    [key: string | symbol]: unknown;
  };

  const buildProxy = (): Stub => {
    const target: Stub = Object.assign(
      function stub() {
        return { data: null, error: buildError() };
      } as Stub,
      {},
    );

    const handler: ProxyHandler<Stub> = {
      get(_, prop) {
        // Avoid accidentally making the stub look like a thenable — that
        // would swallow `await` without reaching user code.
        if (prop === "then" || prop === Symbol.toPrimitive || prop === Symbol.iterator) {
          return undefined;
        }
        // Commonly-destructured fields expected by consumers.
        if (prop === "data") return null;
        if (prop === "error") return buildError();
        return buildProxy();
      },
      apply() {
        // Supabase builder calls (`from`, `select`, `eq`, etc.) and
        // awaited terminal calls both flow through here. Return a fresh
        // proxy so chains keep working, but also expose a safe
        // `{ data, error }` shape for awaited consumers via `get`.
        return buildProxy();
      },
    };

    return new Proxy(target, handler);
  };

  return buildProxy() as unknown as BrowserClient;
};

export const createClient = (): BrowserClient => {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey, isConfigured } = getPublicSupabaseEnv();

  if (!isConfigured) {
    if (!Runtime.isClient()) {
      // SSR / prerender path — return a lazy proxy so static generation
      // doesn't crash. Any real usage on the server would still throw.
      return createDeferredErrorClient();
    }

    if (!hasLoggedMissingEnvWarning) {
      hasLoggedMissingEnvWarning = true;
      console.error(
        "[Assetly] Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
    throw new Error(
      "Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
};

