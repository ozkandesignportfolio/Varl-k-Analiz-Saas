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
    : "APP_URL ayari bulunamadigi icin dogrulama yonlendirmesi mevcut origin ile yapilacak.";

  return (
    <SignupForm
      emailRedirectTo={resolvedEmailRedirectTo}
      pageWarning={redirectWarning}
    />
  );
}
