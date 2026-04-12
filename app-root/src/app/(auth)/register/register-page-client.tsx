"use client";

import { useEffect, useState } from "react";
import SignupForm from "@/components/auth/signup-form";

type RegisterPageClientProps = {
  emailRedirectTo?: string;
};

export default function RegisterPageClient({ emailRedirectTo }: RegisterPageClientProps) {
  const [resolvedEmailRedirectTo, setResolvedEmailRedirectTo] = useState(emailRedirectTo ?? "");
  const [redirectWarning, setRedirectWarning] = useState<string | null>(null);

  useEffect(() => {
    console.log("REGISTER PAGE RENDERED");

    if (emailRedirectTo || typeof window === "undefined") {
      return;
    }

    setResolvedEmailRedirectTo(`${window.location.origin}/auth/callback`);
    setRedirectWarning(
      "APP_URL ayari bulunamadigi icin dogrulama yonlendirmesi mevcut origin ile yapilacak.",
    );
  }, [emailRedirectTo]);

  return (
    <SignupForm
      emailRedirectTo={resolvedEmailRedirectTo}
      pageWarning={redirectWarning}
    />
  );
}
