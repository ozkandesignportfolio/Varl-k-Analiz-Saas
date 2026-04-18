import "server-only";

// Compat shim — yeni tüketiciler doğrudan `@/lib/services/supabase-admin` import etsin.
// Tek resmi API: `getSupabaseAdmin()` (module-closure singleton).
export { getSupabaseAdmin } from "@/lib/services/supabase-admin";
