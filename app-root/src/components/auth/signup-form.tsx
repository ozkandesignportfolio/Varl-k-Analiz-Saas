"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import TurnstileWidget, { type TurnstileWidgetStatus } from "@/components/auth/turnstile-widget";
import {
  UNKNOWN_DEVICE_FINGERPRINT,
  createDeviceFingerprint,
  isUnknownDeviceFingerprint,
} from "@/lib/auth/device-fingerprint";
import {
  canUseLocalhostTurnstileTestKeys,
  TURNSTILE_DOMAIN_INACTIVE_MESSAGE,
  TURNSTILE_SITE_KEY_MISSING_MESSAGE,
  debugPublicTurnstileSiteKey,
  isLocalhostTestTurnstileSiteKey,
  readPublicTurnstileSiteKey,
  resolveTurnstileSiteKeyForHostname,
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
const TURNSTILE_TOKEN_MAX_AGE_MS = 90_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type SignupFormProps = {
  emailRedirectTo: string;
  pageWarning?: string | null;
};

type SignupFormValidationInput = {
  acceptedKvkk: boolean;
  acceptedLegalDocuments: boolean;
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

type SignupTurnstileSectionProps = {
  onStatusChange: (status: TurnstileWidgetStatus) => void;
  onTokenChange: (token: string | null) => void;
  onWarningChange: (warning: string | null) => void;
  resetTrigger: number;
  siteKey: string | null;
};

const translateTurnstileMessage = (message?: string | null) => {
  const normalizedMessage = message?.trim().toLowerCase();

  if (!normalizedMessage) {
    return null;
  }

  if (
    normalizedMessage.includes("bot protection is not available") ||
    normalizedMessage.includes("turnstile verification is not configured on the server") ||
    normalizedMessage.includes("turnstile server verification is not configured") ||
    normalizedMessage.includes("turnstile server dogrulamasi yapilandirilmamis")
  ) {
    return "Guvenlik dogrulamasi yapilandirilmamis. Lutfen daha sonra tekrar deneyin veya yoneticiyle iletisime gecin.";
  }

  if (
    normalizedMessage.includes("turnstile verification could not be completed") ||
    normalizedMessage.includes("turnstile dogrulamasi tamamlanamadi")
  ) {
    return "Guvenlik dogrulamasi su anda tamamlanamadi. Lutfen tekrar deneyin.";
  }

  if (
    normalizedMessage.includes("turnstile verification failed") ||
    normalizedMessage.includes("turnstile dogrulamasi basarisiz oldu")
  ) {
    return "Guvenlik dogrulamasi basarisiz oldu. Lutfen tekrar deneyin.";
  }

  if (normalizedMessage.includes("please complete the turnstile verification")) {
    return "Lutfen bot dogrulamasini tamamlayin.";
  }

  if (
    normalizedMessage.includes("110200") ||
    normalizedMessage.includes(TURNSTILE_DOMAIN_INACTIVE_MESSAGE.toLowerCase())
  ) {
    return TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
  }

  if (
    normalizedMessage.includes("domain cloudflare tarafinda yetkili degil") ||
    normalizedMessage.includes("domain cloudflare tarafında yetkili değil")
  ) {
    return TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
  }

  if (
    normalizedMessage.includes("tarayici eklentisi engelliyor olabilir") ||
    normalizedMessage.includes("tarayıcı eklentisi engelliyor olabilir")
  ) {
    return "Tarayıcı eklentisi engelliyor olabilir";
  }

  return message ?? null;
};

const getTurnstileDiagnosticsMessage = (turnstile?: SignupApiErrorResponse["turnstile"]) => {
  if (!turnstile) {
    return null;
  }

  if (turnstile.hostnameMismatch || turnstile.errorCodes.includes("110200") || turnstile.issue === "domain") {
    return TURNSTILE_DOMAIN_INACTIVE_MESSAGE;
  }

  if (turnstile.errorCodes.includes("invalid-input-secret") || turnstile.issue === "key") {
    return "Guvenlik dogrulamasi sunucu anahtari gecersiz. Site yoneticisi Turnstile secret ayarini kontrol etmeli.";
  }

  if (turnstile.errorCodes.includes("invalid-input-response") || turnstile.issue === "token") {
    return "Guvenlik dogrulamasi tokeni gecersiz veya suresi dolmus. Lutfen yeniden dogrulayin.";
  }

  if (turnstile.issue === "env") {
    return "Guvenlik dogrulamasi server tarafinda yapilandirilmamis. Site yoneticisi env degerlerini kontrol etmeli.";
  }

  if (turnstile.issue === "network") {
    return "Guvenlik dogrulamasi su anda tamamlanamadi. Lutfen tekrar deneyin.";
  }

  return null;
};

const getTurnstileSiteKeyWarning = (
  siteKey: string | null,
  warning: string | null,
  hostname?: string | null,
) => {
  if (warning) {
    return translateTurnstileMessage(warning) ?? warning;
  }

  if (!siteKey) {
    return TURNSTILE_SITE_KEY_MISSING_MESSAGE;
  }

  const normalizedSiteKey = siteKey.trim().toLowerCase();

  if (
    !normalizedSiteKey ||
    normalizedSiteKey.includes("placeholder") ||
    normalizedSiteKey.includes("secret") ||
    normalizedSiteKey.includes("your_turnstile")
  ) {
    return "Guvenlik dogrulamasi ayari gecersiz. Lutfen Turnstile env degerlerini kontrol edin.";
  }

  if (!canUseLocalhostTurnstileTestKeys(hostname) && isLocalhostTestTurnstileSiteKey(siteKey)) {
    return "Guvenlik dogrulamasi ayari gecersiz. Production icin gercek Turnstile anahtarlarini tanimlayin.";
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
    return "Ad, soyad, e-posta, sifre ve sifre tekrari zorunludur.";
  }

  if (!EMAIL_REGEX.test(input.email)) {
    return "Lutfen gecerli bir e-posta adresi girin.";
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `Sifre en az ${PASSWORD_MIN_LENGTH} karakter olmali.`;
  }

  if (input.password !== input.confirmPassword) {
    return "Sifre ve sifre tekrari ayni olmali.";
  }

  if (!input.acceptedLegalDocuments) {
    return "Kullanim Sartlari ve Gizlilik Politikasini kabul etmelisiniz.";
  }

  if (!input.acceptedKvkk) {
    return "KVKK acik riza metnini kabul etmelisiniz.";
  }

  return getTurnstileValidationMessage(input);
};

const getSignupErrorMessage = (
  error?: string,
  fallbackMessage?: string,
  turnstile?: SignupApiErrorResponse["turnstile"],
) => {
  if (error === EMAIL_ALREADY_EXISTS_ERROR) {
    return "Bu e-posta zaten kayitli.";
  }

  if (error === TURNSTILE_FAILED_ERROR) {
    return (
      getTurnstileDiagnosticsMessage(turnstile) ??
      translateTurnstileMessage(fallbackMessage) ??
      "Guvenlik dogrulamasi basarisiz. Lutfen yeniden deneyin."
    );
  }

  if (error === EMAIL_RATE_LIMITED_ERROR || error === RATE_LIMITED_ERROR) {
    return "Cok fazla kayit denemesi yapildi. Lutfen bekleyip tekrar deneyin.";
  }

  if (error === MISSING_FIELDS_ERROR) {
    return "Lutfen tum zorunlu alanlari doldurun.";
  }

  if (error === PASSWORD_MISMATCH_ERROR) {
    return "Sifre ve sifre tekrari ayni olmali.";
  }

  if (error === INVALID_EMAIL_ERROR) {
    return "Lutfen gecerli bir e-posta adresi girin.";
  }

  if (error === INVALID_PASSWORD_ERROR) {
    return `Sifreniz guvenlik kurallarini karsilamiyor. En az ${PASSWORD_MIN_LENGTH} karakter olacak sekilde daha guclu bir sifre girin.`;
  }

  if (error === TERMS_NOT_ACCEPTED_ERROR) {
    return "Kullanim Sartlarini kabul etmelisiniz.";
  }

  if (error === PRIVACY_POLICY_NOT_ACCEPTED_ERROR) {
    return "Gizlilik Politikasini kabul etmelisiniz.";
  }

  if (error === KVKK_CONSENT_REQUIRED_ERROR) {
    return "KVKK acik riza metnini kabul etmelisiniz.";
  }

  if (error === INVALID_REDIRECT_URL_ERROR) {
    return "Kayit yonlendirme adresi gecersiz. Sayfayi yenileyip tekrar deneyin.";
  }

  if (error === INTERNAL_ERROR) {
    return "Kullanici olusturulamadi, lutfen tekrar deneyin.";
  }

  return fallbackMessage ?? "Kayit islemi tamamlanamadi. Lutfen tekrar deneyin.";
};

const SignupTurnstileSection = memo(function SignupTurnstileSection({
  onStatusChange,
  onTokenChange,
  onWarningChange,
  resetTrigger,
  siteKey,
}: SignupTurnstileSectionProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <TurnstileWidget
        onStatusChange={onStatusChange}
        onTokenChange={onTokenChange}
        onWarningChange={onWarningChange}
        resetTrigger={resetTrigger}
        siteKey={siteKey}
      />
    </div>
  );
});

export default function SignupForm({ emailRedirectTo, pageWarning = null }: SignupFormProps) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const { siteKey: envTurnstileSiteKey, warning: envTurnstileWarning } = readPublicTurnstileSiteKey();
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(envTurnstileSiteKey);
  const [resolvedTurnstileWarning, setResolvedTurnstileWarning] = useState<string | null>(
    getTurnstileSiteKeyWarning(envTurnstileSiteKey, envTurnstileWarning),
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegalDocuments, setAcceptedLegalDocuments] = useState(false);
  const [acceptedKvkk, setAcceptedKvkk] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState(UNKNOWN_DEVICE_FINGERPRINT);
  const [fingerprintStatus, setFingerprintStatus] = useState<FingerprintStatus>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileWidgetStatus>("idle");
  const [turnstileRuntimeWarning, setTurnstileRuntimeWarning] = useState<string | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const tokenTimestampRef = useRef<number | null>(null);
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const combinedTurnstileWarning = turnstileRuntimeWarning ?? resolvedTurnstileWarning;

  useEffect(() => {
    debugPublicTurnstileSiteKey();
  }, []);

  useEffect(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : null;
    const nextSiteKey = resolveTurnstileSiteKeyForHostname({
      configuredSiteKey: envTurnstileSiteKey,
      hostname,
    });
    const nextWarning = canUseLocalhostTurnstileTestKeys(hostname)
      ? null
      : getTurnstileSiteKeyWarning(nextSiteKey, envTurnstileWarning, hostname);

    setTurnstileSiteKey(nextSiteKey);
    setResolvedTurnstileWarning(nextWarning);
  }, [envTurnstileSiteKey, envTurnstileWarning]);

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
    acceptedLegalDocuments,
    confirmPassword,
    email,
    firstName,
    lastName,
    password,
    turnstileSiteKey,
    turnstileStatus,
    turnstileToken,
    turnstileWarning: combinedTurnstileWarning ?? (!emailRedirectTo ? "Kayit yonlendirmesi hazirlaniyor." : null),
  });

  const clearMessage = useCallback(() => {
    setMessage((currentMessage) => (currentMessage ? "" : currentMessage));
  }, []);

  const triggerReset = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileStatus("expired");
    tokenTimestampRef.current = null;
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }
    setResetCounter((prev) => prev + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }
    };
  }, []);

  const handleTurnstileTokenChange = useCallback((value: string | null) => {
    if (!submitLockRef.current) {
      clearMessage();
    }

    setTurnstileToken((currentValue) => (currentValue === value ? currentValue : value));

    if (value) {
      tokenTimestampRef.current = Date.now();

      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }

      expiryTimeoutRef.current = setTimeout(() => {
        if (process.env.NODE_ENV === "development") {
          console.debug("[signup.turnstile] Token expired via timeout after 90s.");
        }
        setTurnstileToken(null);
        setTurnstileStatus("expired");
        tokenTimestampRef.current = null;
        expiryTimeoutRef.current = null;
        setMessage("Doğrulama süresi doldu. Lütfen güvenlik kontrolünü tekrar tamamlayın.");
        setResetCounter((prev) => prev + 1);
      }, TURNSTILE_TOKEN_MAX_AGE_MS);

      if (process.env.NODE_ENV === "development") {
        console.debug("[signup.turnstile] Token received.", {
          tokenLength: value.length,
          timestamp: tokenTimestampRef.current,
        });
      }
    } else {
      tokenTimestampRef.current = null;
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
        expiryTimeoutRef.current = null;
      }
    }
  }, [clearMessage]);

  const handleTurnstileWarningChange = useCallback((value: string | null) => {
    if (!submitLockRef.current) {
      clearMessage();
    }

    setTurnstileRuntimeWarning((currentValue) => (currentValue === value ? currentValue : value));
  }, [clearMessage]);

  const handleTurnstileStatusChange = useCallback((value: TurnstileWidgetStatus) => {
    if (!submitLockRef.current) {
      clearMessage();
    }

    setTurnstileStatus((currentValue) => (currentValue === value ? currentValue : value));
  }, [clearMessage]);

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

    if (submitLockRef.current) {
      return;
    }

    setMessage("");

    if (isCooldownActive) {
      setMessage(`${cooldownRemainingSeconds} saniye sonra tekrar deneyin.`);
      return;
    }

    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    const tokenAge = tokenTimestampRef.current ? Date.now() - tokenTimestampRef.current : null;

    if (process.env.NODE_ENV === "development") {
      console.debug("[signup.turnstile] Submit token lifecycle.", {
        tokenAge: tokenAge !== null ? `${Math.round(tokenAge / 1000)}s` : "N/A",
        tokenPresent: Boolean(turnstileToken),
        tokenTimestamp: tokenTimestampRef.current,
      });
    }

    if (!turnstileToken || tokenAge === null || tokenAge > TURNSTILE_TOKEN_MAX_AGE_MS) {
      setMessage("Güvenlik doğrulamasının süresi doldu. Lütfen tekrar doğrulayın.");
      triggerReset();
      setIsSubmitting(false);
      submitLockRef.current = false;
      return;
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 15_000);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          acceptedKvkk,
          acceptedPrivacyPolicy: acceptedLegalDocuments,
          acceptedTerms: acceptedLegalDocuments,
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

        if (
          process.env.NODE_ENV === "development" &&
          errorResult?.error === TURNSTILE_FAILED_ERROR &&
          turnstileStatus !== "unsupported"
        ) {
          console.warn("Turnstile domain mismatch olabilir", {
            hasToken: Boolean(turnstileToken?.trim()),
            responseStatus: response.status,
            turnstileStatus,
          });
        }

        if (
          errorResult?.error === TURNSTILE_FAILED_ERROR ||
          errorResult?.details?.shouldResetTurnstile === true
        ) {
          if (process.env.NODE_ENV === "development") {
            console.debug("[signup.turnstile] Backend requested Turnstile reset.", {
              error: errorResult?.error,
              shouldResetTurnstile: errorResult?.details?.shouldResetTurnstile,
            });
          }
          triggerReset();
        }

        setMessage(
          getSignupErrorMessage(errorResult?.error, errorResult?.message, errorResult?.turnstile) ??
            "Kayit islemi tamamlanamadi. Lutfen tekrar deneyin.",
        );
        return;
      }

      const successMessage =
        successResult.message ??
        (successResult.emailStatus === "failed"
          ? "Hesabiniz olusturuldu ancak dogrulama e-postasi gonderilemedi."
          : emailVerificationSentMessage);

      setMessage(successMessage);

      if (successResult.emailStatus !== "failed") {
        router.push(buildEmailVerificationPath(email, null, { emailSent: true }));
      }
    } catch {
      if (abortController.signal.aborted) {
        setMessage("Kayit istegi zaman asimina ugradi. Sayfa acik kaldi; lutfen tekrar deneyin.");
      } else {
        setMessage("Beklenmeyen bir ag hatasi olustu. Lutfen tekrar deneyin.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
      submitLockRef.current = false;
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
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">Hesap Olustur</h1>
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
                  onChange={(event) => {
                    clearMessage();
                    setFirstName(event.target.value);
                  }}
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
                  onChange={(event) => {
                    clearMessage();
                    setLastName(event.target.value);
                  }}
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
                onChange={(event) => {
                  clearMessage();
                  setEmail(event.target.value);
                }}
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
                onChange={(event) => {
                  clearMessage();
                  setPassword(event.target.value);
                }}
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
                onChange={(event) => {
                  clearMessage();
                  setConfirmPassword(event.target.value);
                }}
                placeholder="Sifrenizi tekrar girin"
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                checked={acceptedLegalDocuments}
                className={consentInputClassName}
                data-testid="register-accepted-legal-documents-input"
                name="acceptedLegalDocuments"
                onChange={(event) => {
                  clearMessage();
                  setAcceptedLegalDocuments(event.target.checked);
                }}
                required
                type="checkbox"
              />
              <span>
                <Link href="/legal/terms" className="font-semibold text-sky-200">
                  Kullanim Sartlari
                </Link>{" "}
                {" "}ve{" "}
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
                onChange={(event) => {
                  clearMessage();
                  setAcceptedKvkk(event.target.checked);
                }}
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

            <SignupTurnstileSection
              onStatusChange={handleTurnstileStatusChange}
              onTokenChange={handleTurnstileTokenChange}
              onWarningChange={handleTurnstileWarningChange}
              resetTrigger={resetCounter}
              siteKey={turnstileSiteKey}
            />

            <button
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="register-submit"
              disabled={isSubmitDisabled}
              type="submit"
            >
              {isSubmitting ? "Hesap Olusturuluyor..." : isCooldownActive ? `Tekrar deneme: ${cooldownRemainingSeconds}s` : "Kayit Ol"}
            </button>

            {message ? (
              <p aria-live="polite" className="text-sm text-slate-200" data-testid="register-message">
                {message}
              </p>
            ) : validationMessage ? (
              <p className={combinedTurnstileWarning ? "text-sm text-amber-200" : "text-sm text-slate-400"}>
                {validationMessage}
              </p>
            ) : pageWarning ? (
              <p className="text-sm text-amber-200">{pageWarning}</p>
            ) : (
              <p className="text-sm text-slate-400">
                {fingerprintStatus === "ready" && "Cihaz guvenlik sinyalleri hazir."}
                {fingerprintStatus === "loading" && "Cihaz guvenlik sinyalleri arka planda hazirlaniyor."}
                {fingerprintStatus === "fallback" &&
                  "Cihaz parmak izi alinamadi, kayit islemi sinirli guvenlik sinyalleriyle devam edecek."}
              </p>
            )}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Zaten hesabin var mi?{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              Giris yap
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
