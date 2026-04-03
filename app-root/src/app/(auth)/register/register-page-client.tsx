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
  INVALID_PASSWORD_ERROR,
  INVALID_REDIRECT_URL_ERROR,
  KVKK_CONSENT_REQUIRED_ERROR,
  PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
  RATE_LIMITED_ERROR,
  RATE_LIMITER_UNAVAILABLE_ERROR,
  SIGNUP_COOLDOWN_MS,
  SIGNUP_COOLDOWN_STORAGE_KEY,
  TERMS_NOT_ACCEPTED_ERROR,
  TURNSTILE_INVALID_ERROR,
  TURNSTILE_REQUIRED_ERROR,
  TURNSTILE_UNAVAILABLE_ERROR,
  type SignupApiErrorResponse,
  type SignupApiSuccessResponse,
} from "@/lib/supabase/signup";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const consentInputClassName = "mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-sky-400";
const trialPlan = getPlanConfig("starter");
const trialAssetLimit = trialPlan.limits.assetsLimit ?? 0;
const trialDocumentLimit = trialPlan.limits.documentsLimit ?? 0;
const trialSubscriptionLimit = trialPlan.limits.subscriptionsLimit ?? 0;
const trialInvoiceUploadLimit = trialPlan.limits.invoiceUploadsLimit ?? 0;
const PASSWORD_MIN_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type RegisterPageClientProps = {
  emailRedirectTo: string;
};

type SignupFormValidationInput = {
  acceptedKvkk: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedTerms: boolean;
  email: string;
  password: string;
  turnstileSiteKey: string | null;
  turnstileToken: string | null;
};

const createDeviceFingerprint = async () => {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return null;
  }

  const fingerprintParts = [
    window.navigator.userAgent,
    window.navigator.language,
    window.navigator.platform,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(window.screen.width),
    String(window.screen.height),
    String(window.devicePixelRatio),
    String(window.navigator.hardwareConcurrency ?? ""),
  ];

  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(fingerprintParts.join("|")),
  );

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const getSignupValidationMessage = (input: SignupFormValidationInput) => {
  if (!input.email || !input.password) {
    return "E-posta ve sifre zorunludur.";
  }

  if (!EMAIL_REGEX.test(input.email)) {
    return "Gecerli bir e-posta adresi girin.";
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `Sifre en az ${PASSWORD_MIN_LENGTH} karakter olmalidir.`;
  }

  if (!input.acceptedTerms) {
    return "Devam etmek icin Kullanim Sartlari'ni kabul etmelisiniz.";
  }

  if (!input.acceptedPrivacyPolicy) {
    return "Devam etmek icin Gizlilik Politikasi'ni kabul etmelisiniz.";
  }

  if (!input.acceptedKvkk) {
    return "Devam etmek icin KVKK aydinlatma metnini kabul etmelisiniz.";
  }

  if (!input.turnstileSiteKey) {
    return "Bot korumasi su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.";
  }

  if (!input.turnstileToken?.trim()) {
    return "Lutfen bot dogrulamasini tamamlayin.";
  }

  return null;
};

const getSignupErrorMessage = (error?: string) => {
  if (error === EMAIL_RATE_LIMITED_ERROR || error === RATE_LIMITED_ERROR) {
    return "Kayit deneme limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin.";
  }

  if (error === EMAIL_ALREADY_EXISTS_ERROR) {
    return "Bu e-posta adresi ile zaten bir hesap bulunuyor.";
  }

  if (error === INVALID_EMAIL_ERROR) {
    return "Gecerli bir e-posta adresi girin.";
  }

  if (error === INVALID_PASSWORD_ERROR) {
    return `Sifre en az ${PASSWORD_MIN_LENGTH} karakter olmalidir.`;
  }

  if (error === TURNSTILE_INVALID_ERROR || error === BOT_DETECTED_ERROR) {
    return "Bot dogrulamasi gecersiz. Lutfen tekrar deneyin.";
  }

  if (error === TURNSTILE_REQUIRED_ERROR) {
    return "Lutfen bot dogrulamasini tamamlayin.";
  }

  if (error === TURNSTILE_UNAVAILABLE_ERROR) {
    return "Bot korumasi su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.";
  }

  if (error === RATE_LIMITER_UNAVAILABLE_ERROR) {
    return "Kayit sistemi su anda gecici olarak kullanilamiyor. Lutfen daha sonra tekrar deneyin.";
  }

  if (error === TERMS_NOT_ACCEPTED_ERROR) {
    return "Devam etmek icin Kullanim Sartlari'ni kabul etmelisiniz.";
  }

  if (error === PRIVACY_POLICY_NOT_ACCEPTED_ERROR) {
    return "Devam etmek icin Gizlilik Politikasi'ni kabul etmelisiniz.";
  }

  if (error === KVKK_CONSENT_REQUIRED_ERROR) {
    return "Devam etmek icin KVKK aydinlatma metnini kabul etmelisiniz.";
  }

  if (error === EMAIL_CONFIRMATION_DISABLED_ERROR) {
    return emailVerificationConfigMismatchMessage;
  }

  if (error === INVALID_REDIRECT_URL_ERROR) {
    return "Kayit baglantisi gecersiz. Sayfayi yenileyip tekrar deneyin.";
  }

  return null;
};

export default function RegisterPageClient({ emailRedirectTo }: RegisterPageClientProps) {
  const router = useRouter();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRefreshNonce, setTurnstileRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void createDeviceFingerprint()
      .then((value) => {
        if (!cancelled) {
          setDeviceFingerprint(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeviceFingerprint(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
  const validationMessage = getSignupValidationMessage({
    acceptedKvkk,
    acceptedPrivacyPolicy,
    acceptedTerms,
    email,
    password,
    turnstileSiteKey,
    turnstileToken,
  });

  const startSignupCooldown = () => {
    if (typeof window === "undefined") {
      return;
    }

    const cooldownEndTimestamp = Date.now() + SIGNUP_COOLDOWN_MS;

    try {
      window.localStorage.setItem(SIGNUP_COOLDOWN_STORAGE_KEY, String(cooldownEndTimestamp));
    } catch {
      // Best-effort client cooldown guard.
    }

    setCooldownRemainingSeconds(getSignupCooldownRemainingSeconds(cooldownEndTimestamp));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (isCooldownActive) {
      setMessage(`Tekrar deneme: ${cooldownRemainingSeconds}s`);
      return;
    }

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    startSignupCooldown();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acceptedKvkk,
          acceptedPrivacyPolicy,
          acceptedTerms,
          deviceFingerprint,
          email,
          emailRedirectTo,
          password,
          turnstileToken,
        }),
      });

      const result = (await response.json().catch(() => null)) as SignupApiErrorResponse | SignupApiSuccessResponse | null;

      if (!response.ok) {
        const errorResult = result && "error" in result ? result : null;
        setMessage(
          getSignupErrorMessage(errorResult?.error) ??
            errorResult?.message ??
            "Kayit sirasinda bir hata olustu. Lutfen tekrar deneyin.",
        );
        return;
      }

      setMessage(emailVerificationSentMessage);
      router.push(buildEmailVerificationPath(email, null, { emailSent: true }));
    } catch {
      setMessage("Kayit sirasinda beklenmeyen bir hata olustu. Lutfen tekrar deneyin.");
    } finally {
      setTurnstileToken(null);
      setTurnstileRefreshNonce((current) => current + 1);
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = isSubmitting || isCooldownActive || Boolean(validationMessage);

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
          <p className="mt-2 text-sm text-slate-300">E-posta, sifre ve yasal onaylarla yeni hesabinizi guvenle olusturun.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">E-posta</span>
              <input
                autoComplete="email"
                className={inputClassName}
                data-testid="register-email-input"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ornek@mail.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Sifre</span>
              <input
                autoComplete="new-password"
                className={inputClassName}
                data-testid="register-password-input"
                minLength={PASSWORD_MIN_LENGTH}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`En az ${PASSWORD_MIN_LENGTH} karakter`}
                required
                type="password"
                value={password}
              />
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                checked={acceptedTerms}
                className={consentInputClassName}
                data-testid="register-accepted-terms-input"
                name="acceptedTerms"
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                required
                type="checkbox"
              />
              <span>
                <Link href="/legal/terms" className="font-semibold text-sky-200">
                  Kullanim Sartlari
                </Link>{" "}
                kabul ediyorum.
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                checked={acceptedPrivacyPolicy}
                className={consentInputClassName}
                data-testid="register-accepted-privacy-policy-input"
                name="acceptedPrivacyPolicy"
                onChange={(event) => setAcceptedPrivacyPolicy(event.target.checked)}
                required
                type="checkbox"
              />
              <span>
                <Link href="/legal/privacy" className="font-semibold text-sky-200">
                  Gizlilik Politikasi
                </Link>{" "}
                kabul ediyorum.
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                checked={acceptedKvkk}
                className={consentInputClassName}
                data-testid="register-accepted-kvkk-input"
                name="acceptedKvkk"
                onChange={(event) => setAcceptedKvkk(event.target.checked)}
                required
                type="checkbox"
              />
              <span>
                <Link href="/legal/kvkk" className="font-semibold text-sky-200">
                  KVKK Aydinlatma Metni
                </Link>{" "}
                icin acik riza verdigimi onayliyorum.
              </span>
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              {turnstileSiteKey ? (
                <TurnstileWidget
                  onTokenChange={setTurnstileToken}
                  refreshNonce={turnstileRefreshNonce}
                  siteKey={turnstileSiteKey}
                />
              ) : (
                <p className="text-sm text-amber-200">
                  Turnstile site key eksik. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` tanimlanmali.
                </p>
              )}
            </div>

            <button
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="register-submit"
              disabled={isSubmitDisabled}
              type="submit"
            >
              {isSubmitting ? "Kayit olusturuluyor..." : isCooldownActive ? `Tekrar deneme: ${cooldownRemainingSeconds}s` : "Kayit Ol"}
            </button>

            {message ? (
              <p aria-live="polite" className="text-sm text-slate-200" data-testid="register-message">
                {message}
              </p>
            ) : validationMessage ? (
              <p className="text-sm text-slate-400">{validationMessage}</p>
            ) : (
              <p className="text-sm text-slate-400">
                Guvenlik sinyalleri icin cihaz iziniz arka planda uretilir{deviceFingerprint ? "." : ", yukleniyor..."}.
              </p>
            )}
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
