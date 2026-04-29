import { Suspense } from "react";
import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import RegisterPageClient from "./register-page-client";

function RegisterPageFallback() {
  return <div>Yükleniyor...</div>;
}

export default function RegisterPage() {
  // Use /auth/callback as the email redirect target
  // The callback handles code exchange and redirects appropriately
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageClient emailRedirectTo={getAuthRedirectUrl("/auth/callback")} />
    </Suspense>
  );
}
