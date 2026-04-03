"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import TurnstileWidget from "@/components/auth/turnstile-widget";
import { getPlanConfig } from "@/lib/plans/plan-config";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";
import {
  buildEmailVerificationPath,
  emailVerificationConfigMismatchMessage,
  emailVerificationSentMessage,
} from "@/lib/supabase/email-verification";
import {
  BOT_DETECTED_ERROR,
  EMAIL_ALREADY_EXISTS_ERROR,
  EMAIL_CONFIRMATION_DISABLED_ERROR,
  EMAIL_RATE_LIMITED_ERROR,
  getSignupCooldownRemainingSeconds,
  INVALID_EMAIL_ERROR,
  RATE_LIMITED_ERROR,
  SIGNUP_COOLDOWN_MS,
  SIGNUP_COOLDOWN_STORAGE_KEY,
  TERMS_NOT_ACCEPTED_ERROR,
} from "@/lib/supabase/signup";

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
  const router = useRouter();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRefreshNonce, setTurnstileRefreshNonce] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncCooldownState = () => {
      try {
        const rawValue = window.localStorage.getItem(SIGNUP_COOLDOWN_STORAGE_KEY);
        const cooldownEndTimestamp = rawValue ? Number(rawValue) : Number.NaN;

        if (!Number.isFinite(cooldownEndTimestamp)) {
          setCooldownRemainingSeconds(0);
          return;
        }

        const nextRemainingSeconds = getSignupCooldownRemainingSeconds(cooldownEndTimestamp);

        if (nextRemainingSeconds <= 0) {
          window.localStorage.removeItem(SIGNUP_COOLDOWN_STORAGE_KEY);
          setCooldownRemainingSeconds(0);
          return;
        }

        setCooldownRemainingSeconds(nextRemainingSeconds);
      } catch {
        setCooldownRemainingSeconds(0);
      }
    };

    syncCooldownState();

    const intervalId = window.setInterval(syncCooldownState, 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const isCooldownActive = cooldownRemainingSeconds > 0;

  const startSignupCooldown = () => {
    if (typeof window === "undefined") {
      return;
    }

    const cooldownEndTimestamp = Date.now() + SIGNUP_COOLDOWN_MS;

    try {
      window.localStorage.setItem(SIGNUP_COOLDOWN_STORAGE_KEY, String(cooldownEndTimestamp));
    } catch {
      // Local storage is best-effort here; the in-memory countdown still blocks repeated attempts.
    }

    setCooldownRemainingSeconds(getSignupCooldownRemainingSeconds(cooldownEndTimestamp));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
    const acceptedTerms = formData.get("acceptedTerms") === "on";

    if (isCooldownActive) {
      setMessage(`Tekrar deneme: ${cooldownRemainingSeconds}s`);
      return;
    }

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

    if (!acceptedTerms) {
      setMessage("Devam etmek icin Kullanim Sartlari'ni kabul etmelisiniz.");
      return;
    }

    if (!turnstileSiteKey) {
      setMessage("Bot korumasi su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.");
      return;
    }

    if (!turnstileToken) {
      setMessage("Lutfen bot dogrulamasini tamamlayin.");
      return;
    }

    startSignupCooldown();
    setIsSubmitting(true);

    try {
      const browserOrigin = typeof window !== "undefined" ? window.location.origin : null;
      const redirectOrigin = new URL(emailRedirectTo).origin;
      console.info("[auth.signup.redirect]", {
        emailRedirectTo,
        browserOrigin,
        redirectOrigin,
        matchesBrowserOrigin: Boolean(browserOrigin && redirectOrigin && browserOrigin === redirectOrigin),
      });

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acceptedTerms,
          fullName,
          email,
          password,
          emailRedirectTo,
          turnstileToken,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
          }
        | null;

      if (!response.ok) {
        if (result?.error === EMAIL_RATE_LIMITED_ERROR || result?.error === RATE_LIMITED_ERROR) {
          setMessage("E-posta limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin.");
          return;
        }

        if (result?.error === EMAIL_ALREADY_EXISTS_ERROR) {
          setMessage("Bu e-posta adresi ile zaten bir hesap bulunuyor.");
          return;
        }

        if (result?.error === INVALID_EMAIL_ERROR) {
          setMessage("Gecerli bir e-posta adresi girin.");
          return;
        }

        if (result?.error === BOT_DETECTED_ERROR) {
          setMessage("Bot dogrulamasi gecersiz. Lutfen tekrar deneyin.");
          return;
        }

        if (result?.error === TERMS_NOT_ACCEPTED_ERROR) {
          setMessage("Devam etmek icin Kullanim Sartlari'ni kabul etmelisiniz.");
          return;
        }

        if (result?.error === EMAIL_CONFIRMATION_DISABLED_ERROR) {
          setMessage(emailVerificationConfigMismatchMessage);
          return;
        }

        setMessage(result?.message || "Kayit sirasinda bir hata olustu. Lutfen tekrar deneyin.");
        return;
      }

      setMessage(emailVerificationSentMessage);
      router.push(buildEmailVerificationPath(email, null, { emailSent: true }));
      return;
    } catch {
      setMessage("Kayit sirasinda beklenmeyen bir hata olustu. Lutfen tekrar deneyin.");
    } finally {
      setTurnstileToken(null);
      setTurnstileRefreshNonce((current) => current + 1);
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

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                name="acceptedTerms"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-sky-400"
                data-testid="register-accepted-terms-input"
              />
              <span>
                <Link href="/legal/terms" className="font-semibold text-sky-200">
                  Kullanim Sartlari
                </Link>{" "}
                kabul ediyorum.
              </span>
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              {turnstileSiteKey ? (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  refreshNonce={turnstileRefreshNonce}
                  onTokenChange={setTurnstileToken}
                />
              ) : (
                <p className="text-sm text-amber-200">
                  Turnstile site key eksik. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` tanimlanmali.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isCooldownActive}
              data-testid="register-submit"
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Kayit olusturuluyor..." : isCooldownActive ? `Tekrar deneme: ${cooldownRemainingSeconds}s` : "Kayit Ol"}
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
