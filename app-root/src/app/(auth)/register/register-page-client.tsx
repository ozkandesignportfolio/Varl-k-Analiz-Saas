"use client";

import SignupForm from "@/components/auth/signup-form";

type RegisterPageClientProps = {
  emailRedirectTo: string;
};

export default function RegisterPageClient({ emailRedirectTo }: RegisterPageClientProps) {
  return <SignupForm emailRedirectTo={emailRedirectTo} />;
}
