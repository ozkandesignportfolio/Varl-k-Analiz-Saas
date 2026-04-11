import { requireAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import LoginPageClient from "./login-page-client";

export default function LoginPage() {
  // Use /auth/callback as the email redirect target
  // The callback handles code exchange and redirects appropriately
  return <LoginPageClient emailRedirectTo={requireAuthRedirectUrl("/auth/callback")} />;
}
