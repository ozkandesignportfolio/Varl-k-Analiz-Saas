import { requireAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import LoginPageClient from "./login-page-client";

export default function LoginPage() {
  return <LoginPageClient emailRedirectTo={requireAuthRedirectUrl("/verify-email")} />;
}
