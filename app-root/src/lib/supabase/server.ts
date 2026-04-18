import "server-only";

// Compat shim — yeni tüketiciler `@/lib/services/supabase-server` import etsin.
// Eski `createClient()` ismi alias olarak korunur.
export { getSupabaseServerClient as createClient } from "@/lib/services/supabase-server";
export { getSupabaseServerClient } from "@/lib/services/supabase-server";
export type { SupabaseServerClientContext } from "@/lib/services/supabase-server";
