import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "@/lib/env/runtime-env";

/**
 * Supabase admin (service-role) singleton accessor.
 *
 *  - Proxy yok; sadece module closure singleton.
 *  - İlk `getSupabaseAdmin()` çağrısında CONFIG'den okur, istemciyi kurar,
 *    cache'ler. Sonraki çağrılar O(1) aynı instance'ı döner.
 *  - CONFIG geçersizse zincir üstü `getConfig()` fırlatır — bu dosyada ek
 *    doğrulama YOKTUR.
 */

let CLIENT: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (CLIENT) {
    return CLIENT;
  }

  const config = getConfig();
  CLIENT = createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return CLIENT;
};
