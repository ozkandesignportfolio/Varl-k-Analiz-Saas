"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { getPlanConfig } from "@/lib/plans/plan-config";
import {
  isEmailNotConfirmedError,
  isEmailRateLimitError,
  isSupabaseUserEmailConfirmed,
} from "@/lib/supabase/auth-errors";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildEmailVerificationPath,
  emailVerificationPromptMessage,
  getEmailVerificationRedirectUrl,
} from "@/lib/supabase/email-verification";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const trialPlan = getPlanConfig("starter");
const trialAssetLimit = trialPlan.limits.assetsLimit ?? 0;
const trialDocumentLimit = trialPlan.limits.documentsLimit ?? 0;
const trialSubscriptionLimit = trialPlan.limits.subscriptionsLimit ?? 0;
const trialInvoiceUploadLimit = trialPlan.limits.invoiceUploadsLimit ?? 0;

export default function RegisterPage() {
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
      setMessage("Ad soyad, e-posta ve ÅŸifre zorunludur.");
      return;
    }

    if (password.length < 6) {
      setMessage("Åifre en az 6 karakter olmalÄ±dÄ±r.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Åifreler eÅŸleÅŸmiyor.");
      return;
    }

    setIsSubmitting(true);

    try {
      const emailRedirectTo = getEmailVerificationRedirectUrl();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setMessage("E-posta limiti aÅŸÄ±ldÄ±. LÃ¼tfen kÄ±sa bir sÃ¼re sonra tekrar deneyin.");
          return;
        }

        if (isEmailNotConfirmedError(error)) {
          setMessage(emailVerificationPromptMessage);
          router.push(buildEmailVerificationPath(email));
          return;
        }

        setMessage(error.message || "KayÄ±t sÄ±rasÄ±nda bir hata oluÅŸtu. LÃ¼tfen tekrar deneyin.");
        return;
      }

      const requiresEmailVerification = !data.session || !isSupabaseUserEmailConfirmed(data.user);

      if (requiresEmailVerification) {
        await supabase.auth.signOut();
        setMessage(emailVerificationPromptMessage);
        router.push(buildEmailVerificationPath(email));
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setMessage("KayÄ±t tamamlandÄ± ancak oturum baÅŸlatÄ±lamadÄ±. LÃ¼tfen giriÅŸ yapmayÄ± deneyin.");
      router.push("/login");
    } catch {
      setMessage("KayÄ±t sÄ±rasÄ±nda beklenmeyen bir hata oluÅŸtu. LÃ¼tfen tekrar deneyin.");
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
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">HesabÄ±nÄ±zÄ± oluÅŸturun</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Deneme planÄ±nda {trialAssetLimit} varlÄ±k, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik ve{" "}
            {trialInvoiceUploadLimit} fatura yükleme ile başlayın. İstediğiniz zaman {PREMIUM_MONTHLY_PRICE_LABEL} premium plana geçin.
          </p>
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">KayÄ±t Ol</h2>
          <p className="mt-2 text-sm text-slate-300">Yeni hesabÄ±nÄ±zÄ± oluÅŸturun.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Ad Soyad</span>
              <input
                name="fullName"
                type="text"
                required
                className={inputClassName}
                placeholder="Ã–rnek: Osman YÄ±lmaz"
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
              <span className="mb-1.5 block text-sm text-slate-300">Åifre</span>
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
              <span className="mb-1.5 block text-sm text-slate-300">Åifre Tekrar</span>
              <input
                name="passwordConfirm"
                type="password"
                required
                minLength={6}
                className={inputClassName}
                placeholder="Åifrenizi tekrar girin"
                data-testid="register-password-confirm-input"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="register-submit"
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "KayÄ±t oluÅŸturuluyor..." : "KayÄ±t Ol"}
            </button>

            {message ? (
              <p className="text-sm text-slate-200" data-testid="register-message">
                {message}
              </p>
            ) : null}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            HesabÄ±nÄ±z var mÄ±?{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              GiriÅŸ yap
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}


