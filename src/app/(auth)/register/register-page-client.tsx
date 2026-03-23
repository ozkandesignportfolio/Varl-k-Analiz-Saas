"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { getPlanConfig } from "@/lib/plans/plan-config";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";
import {
  isEmailNotConfirmedError,
  isEmailRateLimitError,
  isSupabaseUserEmailConfirmed,
} from "@/lib/supabase/auth-errors";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildEmailVerificationPath,
  emailVerificationConfigMismatchMessage,
  emailVerificationSentMessage,
} from "@/lib/supabase/email-verification";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const trialPlan = getPlanConfig("starter");
const trialAssetLimit = trialPlan.limits.assetsLimit ?? 0;
const trialDocumentLimit = trialPlan.limits.documentsLimit ?? 0;
const trialSubscriptionLimit = trialPlan.limits.subscriptionsLimit ?? 0;
const trialInvoiceUploadLimit = trialPlan.limits.invoiceUploadsLimit ?? 0;

type RegisterPageClientProps = {
  emailRedirectTo: string;
};

export default function RegisterPageClient({ emailRedirectTo }: RegisterPageClientProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (!fullName || !email || !password) {
      setMessage("Ad soyad, e-posta ve sifre zorunludur.");
      return;
    }

    if (password.length < 6) {
      setMessage("Sifre en az 6 karakter olmalidir.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Sifreler eslesmiyor.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setMessage("E-posta limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin.");
          return;
        }

        if (isEmailNotConfirmedError(error)) {
          setMessage(emailVerificationSentMessage);
          router.push(buildEmailVerificationPath(email, null, { emailSent: true }));
          return;
        }

        setMessage(error.message || "Kayit sirasinda bir hata olustu. Lutfen tekrar deneyin.");
        return;
      }

      if (data.session && data.user && isSupabaseUserEmailConfirmed(data.user)) {
        await supabase.auth.signOut();
        setMessage(emailVerificationConfigMismatchMessage);
        return;
      }

      const requiresEmailVerification = !data.session || !isSupabaseUserEmailConfirmed(data.user);

      if (requiresEmailVerification) {
        await supabase.auth.signOut();
        setMessage(emailVerificationSentMessage);
        router.push(buildEmailVerificationPath(email, null, { emailSent: true }));
        return;
      }

      setMessage("Kayit tamamlandi ancak e-posta dogrulamasi baslatilamadi. Lutfen destek ile iletisime gecin.");
    } catch {
      setMessage("Kayit sirasinda beklenmeyen bir hata olustu. Lutfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
      </div>

      <div className="relative mx-auto grid w-full max-w-4xl gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="premium-panel p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300"
          >
            Assetly
          </Link>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">Hesabinizi olusturun</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Deneme planinda {trialAssetLimit} varlik, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik ve{" "}
            {trialInvoiceUploadLimit} fatura yukleme ile baslayin. Istediginiz zaman {PREMIUM_MONTHLY_PRICE_LABEL} premium plana gecin.
          </p>
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Kayit Ol</h2>
          <p className="mt-2 text-sm text-slate-300">Yeni hesabinizi olusturun.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Ad Soyad</span>
              <input
                name="fullName"
                type="text"
                required
                className={inputClassName}
                placeholder="Ornek: Osman Yilmaz"
                data-testid="register-fullname-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">E-posta</span>
              <input
                name="email"
                type="email"
                required
                className={inputClassName}
                placeholder="ornek@mail.com"
                data-testid="register-email-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Sifre</span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className={inputClassName}
                placeholder="En az 6 karakter"
                data-testid="register-password-input"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Sifre Tekrar</span>
              <input
                name="passwordConfirm"
                type="password"
                required
                minLength={6}
                className={inputClassName}
                placeholder="Sifrenizi tekrar girin"
                data-testid="register-password-confirm-input"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="register-submit"
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Kayit olusturuluyor..." : "Kayit Ol"}
            </button>

            {message ? (
              <p className="text-sm text-slate-200" data-testid="register-message">
                {message}
              </p>
            ) : null}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Hesabiniz var mi?{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              Giris yap
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
