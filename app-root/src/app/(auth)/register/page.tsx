import { Suspense } from "react";
import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import RegisterPageClient from "./register-page-client";

function RegisterPageFallback() {
  return <div>Yukleniyor...</div>;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageClient emailRedirectTo={getAuthRedirectUrl("/verify-email")} />
    </Suspense>
  );
}
