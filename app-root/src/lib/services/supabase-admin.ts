import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";

/**
 * Supabase admin (service-role) singleton accessor.
 *
 *  - Proxy yok; sadece module closure singleton.
 *  - İlk `getSupabaseAdmin()` çağrısında CONFIG'den okur, istemciyi kurar,
 *    cache'ler. Sonraki çağrılar O(1) aynı instance'ı döner.
 *  - CONFIG geçersizse zincir üstü `getConfig()` fırlatır — bu dosyada ek
 *    doğrulama YOKTUR.
 *  - Ek güvenlik: key'in gerçekten service_role olduğu JWT payload'dan doğrulanır.
 */

/**
 * Decode JWT payload (second segment) without external libraries.
 * Returns parsed JSON or null on any failure.
 */
const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

let CLIENT: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (CLIENT) {
    return CLIENT;
  }

  const url = ServerEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = ServerEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Guard 1: service role key must not be empty (ServerEnv already throws, but be explicit)
  if (!serviceRoleKey || serviceRoleKey.trim().length === 0) {
    throw new Error(
      "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is missing or empty. " +
      "Cannot create admin client."
    );
  }

  // Guard 2: service role key must NOT be the same as anon key
  if (serviceRoleKey === anonKey) {
    throw new Error(
      "[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is identical to NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "This means the admin client would operate with anon privileges and RLS would block queries. " +
      "Set the correct service_role key from your Supabase dashboard → Settings → API."
    );
  }

  // Guard 3: decode JWT payload and verify role claim
  const payload = decodeJwtPayload(serviceRoleKey);
  const detectedRole = payload?.role ?? "UNKNOWN";

  console.log("[supabase-admin] INIT:", {
    hasServiceRoleKey: true,
    keyRole: detectedRole,
    keyLength: serviceRoleKey.length,
    supabaseHost: (() => { try { return new URL(url).hostname; } catch { return "INVALID_URL"; } })(),
  });

  if (detectedRole !== "service_role") {
    throw new Error(
      `[supabase-admin] SUPABASE_SERVICE_ROLE_KEY JWT has role="${String(detectedRole)}" ` +
      `(expected "service_role"). The key is likely the anon key or an invalid token. ` +
      `Update SUPABASE_SERVICE_ROLE_KEY in your environment.`
    );
  }

  CLIENT = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return CLIENT;
};
