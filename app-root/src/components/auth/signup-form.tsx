"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import TurnstileWidget, { type TurnstileWidgetStatus } from "@/components/auth/turnstile-widget";
import {
  UNKNOWN_DEVICE_FINGERPRINT,
  createDeviceFingerprint,
  isUnknownDeviceFingerprint,
} from "@/lib/auth/device-fingerprint";
import {
  debugPublicTurnstileSiteKey,
  readPublicTurnstileSiteKey,
} from "@/lib/env/turnstile";
import { getPlanConfig } from "@/lib/plans/plan-config";
import { PREMIUM_MONTHLY_PRICE_LABEL } from "@/lib/plans/pricing";
import {
  buildEmailVerificationPath,
  emailVerificationSentMessage,
} from "@/lib/supabase/email-verification";
import {
  EMAIL_ALREADY_EXISTS_ERROR,
  EMAIL_RATE_LIMITED_ERROR,
  INTERNAL_ERROR,
  INVALID_EMAIL_ERROR,
  INVALID_PASSWORD_ERROR,
  INVALID_REDIRECT_URL_ERROR,
  KVKK_CONSENT_REQUIRED_ERROR,
  MISSING_FIELDS_ERROR,
  PASSWORD_MISMATCH_ERROR,
  PRIVACY_POLICY_NOT_ACCEPTED_ERROR,
  RATE_LIMITED_ERROR,
  SIGNUP_COOLDOWN_MS,
  SIGNUP_COOLDOWN_STORAGE_KEY,
  TERMS_NOT_ACCEPTED_ERROR,
  TURNSTILE_FAILED_ERROR,
  getSignupCooldownRemainingSeconds,
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

type SignupFormProps = {
  emailRedirectTo: string;
};

type SignupFormValidationInput = {
  acceptedKvkk: boolean;
  acceptedPrivacyPolicy: boolean;
  acceptedTerms: boolean;
  confirmPassword: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  turnstileSiteKey: string | null;
  turnstileStatus: TurnstileWidgetStatus;
  turnstileToken: string | null;
  turnstileWarning: string | null;
};

type FingerprintStatus = "fallback" | "loading" | "ready";

const translateTurnstileMessage = (message?: string | null) => {
  const normalizedMessage = message?.trim().toLowerCase();

  if (!normalizedMessage) {
    return null;
  }

  if (
    normalizedMessage.includes("bot protection is not available") ||
    normalizedMessage.includes("turnstile verification is not configured on the server") ||
    normalizedMessage.includes("turnstile server verification is not configured")
  ) {
    return "Bot korumasi su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.";
  }

  if (normalizedMessage.includes("turnstile verification could not be completed")) {
    return "Guvenlik dogrulamasi su anda tamamlanamadi. Lutfen tekrar deneyin.";
  }

  if (normalizedMessage.includes("turnstile verification failed")) {
    return "Guvenlik dogrulamasi basarisiz oldu. Lutfen tekrar deneyin.";
  }

  if (normalizedMessage.includes("please complete the turnstile verification")) {
    return "Lutfen bot dogrulamasini tamamlayin.";
  }

  return message ?? null;
};

const getTurnstileSiteKeyWarning = (siteKey: string | null, warning: string | null) => {
  if (warning) {
    return translateTurnstileMessage(warning) ?? warning;
  }

  if (!siteKey) {
    return "Bot korumasi su anda kullanilamiyor. Lutfen daha sonra tekrar deneyin.";
  }

  const normalizedSiteKey = siteKey.trim().toLowerCase();

  if (
    !normalizedSiteKey ||
    normalizedSiteKey.includes("placeholder") ||
    normalizedSiteKey.includes("secret") ||
    normalizedSiteKey.includes("your_turnstile")
  ) {
    return "Bot korumasi ayari gecersiz. Lutfen daha sonra tekrar deneyin.";
  }

  return null;
};

const getTurnstileValidationMessage = ({
  turnstileSiteKey,
  turnstileStatus,
  turnstileToken,
  turnstileWarning,
}: Pick<
  SignupFormValidationInput,
  "turnstileSiteKey" | "turnstileStatus" | "turnstileToken" | "turnstileWarning"
>) => {
  if (turnstileWarning || !turnstileSiteKey) {
    return turnstileWarning;
  }

  if (!turnstileToken?.trim()) {
    return "Lutfen bot dogrulamasini tamamlayin.";
  }

  if (turnstileStatus === "expired") {
    return "Bot dogrulamasinin suresi doldu. Lutfen yeniden tamamlayin.";
  }

  if (turnstileStatus === "error") {
    return "Bot dogrulamasi basarisiz oldu. Lutfen tekrar deneyin.";
  }

  if (turnstileStatus !== "verified") {
    return "Lutfen bot dogrulamasini tamamlayin.";
  }

  return null;
};

const getSignupValidationMessage = (input: SignupFormValidationInput) => {
  if (!input.firstName || !input.lastName || !input.email || !input.password || !input.confirmPassword) {
    return "First name, last name, email, password, and password confirmation are required.";
  }

  if (!EMAIL_REGEX.test(input.email)) {
    return "Please enter a valid email address.";
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }

  if (input.password !== input.confirmPassword) {
    return "Password and password confirmation must match.";
  }

  if (!input.acceptedTerms) {
    return "You must accept the Terms of Service to continue.";
  }

  if (!input.acceptedPrivacyPolicy) {
    return "You must accept the Privacy Policy to continue.";
  }

  if (!input.acceptedKvkk) {
    return "You must accept the KVKK consent to continue.";
  }

  return getTurnstileValidationMessage(input);
};

const getSignupErrorMessage = (error?: string, fallbackMessage?: string) => {
  if (error === EMAIL_ALREADY_EXISTS_ERROR) {
    return "This email is already registered.";
  }

  if (error === TURNSTILE_FAILED_ERROR) {
    return (
      translateTurnstileMessage(fallbackMessage) ??
      "Guvenlik dogrulamasi basarisiz oldu. Lutfen Turnstile dogrulamasini yeniden tamamlayin."
    );
  }

  if (error === EMAIL_RATE_LIMITED_ERROR || error === RATE_LIMITED_ERROR) {
    return fallbackMessage ?? "Too many signup attempts. Please wait and try again.";
  }

  if (error === MISSING_FIELDS_ERROR) {
    return fallbackMessage ?? "Please complete all required fields.";
  }

  if (error === PASSWORD_MISMATCH_ERROR) {
    return "Password and password confirmation must match.";
  }

  if (error === INVALID_EMAIL_ERROR) {
    return "Please enter a valid email address.";
  }

  if (error === INVALID_PASSWORD_ERROR) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }

  if (error === TERMS_NOT_ACCEPTED_ERROR) {
    return "You must accept the Terms of Service to continue.";
  }

  if (error === PRIVACY_POLICY_NOT_ACCEPTED_ERROR) {
    return "You must accept the Privacy Policy to continue.";
  }

  if (error === KVKK_CONSENT_REQUIRED_ERROR) {
    return "You must accept the KVKK consent to continue.";
  }

  if (error === INVALID_REDIRECT_URL_ERROR) {
    return fallbackMessage ?? "The signup redirect URL is invalid. Please refresh the page and try again.";
  }

  if (error === INTERNAL_ERROR) {
    return fallbackMessage ?? "We could not complete signup. Please try again.";
  }

  return fallbackMessage ?? "We could not complete signup. Please try again.";
};

export default function SignupForm({ emailRedirectTo }: SignupFormProps) {
  const router = useRouter();
  const { siteKey: turnstileSiteKey, warning: turnstileWarning } = readPublicTurnstileSiteKey();
  const resolvedTurnstileWarning = getTurnstileSiteKeyWarning(turnstileSiteKey, turnstileWarning);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState(UNKNOWN_DEVICE_FINGERPRINT);
  const [fingerprintStatus, setFingerprintStatus] = useState<FingerprintStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileWidgetStatus>("idle");
  const [turnstileRefreshNonce, setTurnstileRefreshNonce] = useState(0);

  useEffect(() => {
    debugPublicTurnstileSiteKey();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void createDeviceFingerprint().then((value) => {
      if (cancelled) {
        return;
      }

      setDeviceFingerprint(value);
      setFingerprintStatus(isUnknownDeviceFingerprint(value) ? "fallback" : "ready");
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
    confirmPassword,
    email,
    firstName,
    lastName,
    password,
    turnstileSiteKey,
    turnstileStatus,
    turnstileToken,
    turnstileWarning: resolvedTurnstileWarning,
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
      setMessage(`Try again in ${cooldownRemainingSeconds}s.`);
      return;
    }

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

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
          confirmPassword,
          deviceFingerprint,
          email,
          emailRedirectTo,
          firstName,
          lastName,
          password,
          turnstileToken,
        }),
      });

      const result = (await response.json().catch(() => null)) as SignupApiErrorResponse | SignupApiSuccessResponse | null;
      const errorResult = result && "error" in result ? result : null;
      const successResult =
        result && "ok" in result && result.ok && result.verified === true ? result : null;

      if (!response.ok || !successResult) {
        if (response.status === 429 || errorResult?.error === RATE_LIMITED_ERROR || errorResult?.error === EMAIL_RATE_LIMITED_ERROR) {
          startSignupCooldown();
        }

        setMessage(
          getSignupErrorMessage(errorResult?.error, errorResult?.message) ??
            "We could not complete signup. Please try again.",
        );
        return;
      }

      const successMessage =
        successResult.message ??
        (successResult.emailStatus === "failed"
          ? "Your account was created, but the verification email could not be sent."
          : emailVerificationSentMessage);

      setMessage(successMessage);

      if (successResult.emailStatus !== "failed") {
        router.push(buildEmailVerificationPath(email, null, { emailSent: true }));
      }
    } catch {
      setMessage("Unexpected network error. Please try again.");
    } finally {
      setTurnstileToken(null);
      setTurnstileStatus(turnstileSiteKey ? "idle" : "unsupported");
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
          <p className="mt-2 text-sm text-slate-300">Ad, soyad, e-posta, sifre ve yasal onaylarla yeni hesabinizi guvenle olusturun.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">Ad</span>
                <input
                  autoComplete="given-name"
                  className={inputClassName}
                  name="firstName"
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="Adiniz"
                  required
                  type="text"
                  value={firstName}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">Soyad</span>
                <input
                  autoComplete="family-name"
                  className={inputClassName}
                  name="lastName"
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Soyadiniz"
                  required
                  type="text"
                  value={lastName}
                />
              </label>
            </div>

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

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Sifre Tekrari</span>
              <input
                autoComplete="new-password"
                className={inputClassName}
                minLength={PASSWORD_MIN_LENGTH}
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Sifrenizi tekrar girin"
                required
                type="password"
                value={confirmPassword}
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
              {resolvedTurnstileWarning ? (
                <p className="text-sm text-amber-200" role="alert">
                  {resolvedTurnstileWarning}
                </p>
              ) : (
                <TurnstileWidget
                  onStatusChange={setTurnstileStatus}
                  onTokenChange={setTurnstileToken}
                  refreshNonce={turnstileRefreshNonce}
                  siteKey={turnstileSiteKey}
                />
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
              <p className={resolvedTurnstileWarning ? "text-sm text-amber-200" : "text-sm text-slate-400"}>
                {validationMessage}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                {fingerprintStatus === "ready" && "Device security signals are ready."}
                {fingerprintStatus === "loading" && "Device security signals are loading in the background."}
                {fingerprintStatus === "fallback" &&
                  "Device fingerprint is unavailable, but signup can continue with reduced device signals."}
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
