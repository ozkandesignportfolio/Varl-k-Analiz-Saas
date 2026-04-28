"use client";

import SignupForm from "@/components/auth/signup-form";
import { Runtime } from "@/lib/env/runtime";

type RegisterPageClientProps = {
  emailRedirectTo?: string;
};

export default function RegisterPageClient({ emailRedirectTo }: RegisterPageClientProps) {
  const fallbackRedirect = Runtime.isClient() ? `${window.location.origin}/auth/callback` : "";
  const resolvedEmailRedirectTo = emailRedirectTo ?? fallbackRedirect;
  const redirectWarning = emailRedirectTo
    ? null
    : "APP_URL ayarı bulunamadığı için doğrulama yönlendirmesi mevcut origin ile yapılacak.";

  return (
    <SignupForm
      emailRedirectTo={resolvedEmailRedirectTo}
      pageWarning={redirectWarning}
    />
  );
}
