import { Suspense } from "react";
import { requireAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import VerifyEmailClient from "./verify-email-client";

function VerifyEmailFallback() {
  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8" data-testid="verify-email-root">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
      </div>

      <div className="relative mx-auto grid w-full max-w-4xl gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="premium-panel p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300">
            Assetly
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">E-posta Doğrulama</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">Yükleniyor...</p>
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Bağlantı Hazırlanıyor</h2>
          <p className="mt-2 text-sm text-slate-300">Doğrulama akışı hazırlanıyor...</p>
        </section>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  // Use /auth/callback as the email redirect target
  // The callback handles code exchange and redirects appropriately
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailClient emailRedirectTo={requireAuthRedirectUrl("/auth/callback")} />
    </Suspense>
  );
}
