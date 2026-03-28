import { requireAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import RegisterPageClient from "./register-page-client";

export default function RegisterPage() {
  return <RegisterPageClient emailRedirectTo={requireAuthRedirectUrl("/verify-email")} />;
}
