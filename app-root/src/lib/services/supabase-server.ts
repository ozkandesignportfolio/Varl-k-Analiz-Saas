import "server-only";

import {
  createServerClient as createSupabaseSsrServerClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";

/**
 * Supabase server (SSR) istemci accessor'ı.
 *
 *  - Sadece CONFIG'i tüketir; ham ortam değişkenlerini veya `parseServerEnv`'i doğrudan
 *    kullanmaz.
 *  - **Documented exception (point 5)**: Supabase SSR istemci cookie'lere bağlıdır
 *    ve cookies Next.js'in per-request `cookies()` API'si üzerinden gelir.
 *    Bu nedenle bu accessor her çağrıda YENİ istemci döndürür. Bu, "init once
 *    per process" kuralının bilinçli istisnasıdır.
 *  - Cookie'siz kullanım (ör. cron, service-role iş) için bunu DEĞİL,
 *    `getSupabaseAdmin()`'i kullanın.
 */

export type SupabaseServerClientContext = {
  cookies?: CookieMethodsServer;
};

const buildDefaultCookieAdapter = async (): Promise<CookieMethodsServer> => {
  const cookieStore = await cookies();

  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Pure Server Component context'lerinde cookie set edilemez; middleware
        // refresh akışı cookie senkronizasyonunu yapar.
      }
    },
  };
};

export const getSupabaseServerClient = async (
  context?: SupabaseServerClientContext,
): Promise<SupabaseClient> => {
  const cookieAdapter = context?.cookies ?? (await buildDefaultCookieAdapter());

  return createSupabaseSsrServerClient(
    ServerEnv.NEXT_PUBLIC_SUPABASE_URL,
    ServerEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: cookieAdapter },
  );
};
