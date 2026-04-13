import "client-only";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Log env vars for debugging (only in development)
if (typeof window !== "undefined") {
  console.log("SUPABASE_URL", supabaseUrl);
  console.log("SUPABASE_ANON_KEY_PREFIX", supabaseAnonKey?.slice(0, 10) + "...");
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = () => {
  if (!browserClient) {
    console.log("Creating Supabase client (singleton)");
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
};

