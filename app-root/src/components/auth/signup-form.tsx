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
  TURNSTILE_TOKEN_USED_ERROR,
  getSignupCooldownRemainingSeconds,
  type SignupApiErrorResponse,
  type SignupApiSuccessResponse,
} from "@/lib/supabase/signup";

// PRODUCTION-SAFE STATE MACHINE
// Valid states: idle -> verifying_captcha -> creating_user -> sending_email -> success | rollback | error
type SignupState =
  | { type: "idle" }
  | { type: "verifying_captcha"; token: string; requestId: string }
  | { type: "creating_user"; token: string; requestId: string }
  | { type: "sending_email"; userId: string; requestId: string }
  | { type: "success"; emailStatus: "queued" | "sent" | "failed"; userMessage: string }
  | { type: "rollback"; reason: string; userMessage: string }  // Backend rolled back user creation
  | { type: "error"; error: string; shouldResetTurnstile: boolean; userMessage: string };

// Token lifecycle state - SINGLE SOURCE OF TRUTH
type TokenLifecycle =
  | { type: "empty" }
  | { type: "available"; token: string; expiresAt: number }
  | { type: "consumed"; token: string; usedAt: number; requestId: string }
  | { type: "expired"; previousToken: string; expiredAt: number };

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

// Generate unique request ID for tracking
const generateRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

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
  // Map error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    [EMAIL_ALREADY_EXISTS_ERROR]: "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapmayı deneyin.",
    [TURNSTILE_TOKEN_USED_ERROR]: "Bu güvenlik doğrulaması zaten kullanıldı. Lütfen yeniden doğrulayın.",
    [TURNSTILE_FAILED_ERROR]: getTurnstileDiagnosticsMessage(turnstile) ?? "Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin.",
    [EMAIL_RATE_LIMITED_ERROR]: "Çok fazla kayıt denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin.",
    [RATE_LIMITED_ERROR]: "Çok fazla kayıt denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin.",
    [MISSING_FIELDS_ERROR]: "Lütfen tüm zorunlu alanları doldurun.",
    [PASSWORD_MISMATCH_ERROR]: "Şifre ve şifre tekrarı aynı olmalı.",
    [INVALID_EMAIL_ERROR]: "Lütfen geçerli bir e-posta adresi girin.",
    [INVALID_PASSWORD_ERROR]: `Şifreniz en az ${PASSWORD_MIN_LENGTH} karakter olmalı ve büyük harf, küçük harf, rakam içermeli.`,
    [TERMS_NOT_ACCEPTED_ERROR]: "Kullanım Şartlarını kabul etmelisiniz.",
    [PRIVACY_POLICY_NOT_ACCEPTED_ERROR]: "Gizlilik Politikasını kabul etmelisiniz.",
    [KVKK_CONSENT_REQUIRED_ERROR]: "KVKK açık rıza metnini kabul etmelisiniz.",
    [INVALID_REDIRECT_URL_ERROR]: "Kayıt yönlendirme adresi geçersiz. Sayfayı yenileyip tekrar deneyin.",
    [INTERNAL_ERROR]: "Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.",
  };

  // Return mapped message or backend-provided message (never generic)
  if (error && errorMessages[error]) {
    return errorMessages[error];
  }

  // If backend provided a specific message, use it
  if (fallbackMessage && fallbackMessage.length > 0) {
    return fallbackMessage;
  }

  // Last resort - use error code as message (should never happen)
  return error || "Beklenmeyen hata oluştu";
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
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileWidgetStatus>("idle");
  const [turnstileRuntimeWarning, setTurnstileRuntimeWarning] = useState<string | null>(null);
  const [resetCounter, setResetCounter] = useState(0);

  // PRODUCTION-SAFE: State machine for signup flow
  const [signupState, setSignupState] = useState<SignupState>({ type: "idle" });

  // SINGLE SOURCE OF TRUTH: Token lifecycle - no separate refs!
  const tokenLifecycleRef = useRef<TokenLifecycle>({ type: "empty" });
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed values from state machine
  const isSubmitting = signupState.type !== "idle" && signupState.type !== "success" && signupState.type !== "error";
  const message = signupState.type === "success"
    ? signupState.userMessage
    : signupState.type === "error"
      ? signupState.userMessage
      : "";

  const combinedTurnstileWarning = turnstileRuntimeWarning ?? resolvedTurnstileWarning;

  // Helper to get current turnstile token from lifecycle
  const getCurrentToken = useCallback((): string | null => {
    const lifecycle = tokenLifecycleRef.current;
    if (lifecycle.type === "available") {
      return lifecycle.token;
    }
    if (lifecycle.type === "consumed") {
      return lifecycle.token; // Still return for validation, but it's consumed
    }
    return null;
  }, []);

  // Helper to check if token is valid for submission
  const isTokenValidForSubmission = useCallback((): boolean => {
    const lifecycle = tokenLifecycleRef.current;
    if (lifecycle.type !== "available") {
      return false;
    }
    const now = Date.now();
    if (now > lifecycle.expiresAt) {
      // Token expired - transition state
      tokenLifecycleRef.current = { type: "expired", previousToken: lifecycle.token, expiredAt: now };
      return false;
    }
    return true;
  }, []);

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
  const currentToken = getCurrentToken();
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
    turnstileToken: currentToken,
    turnstileWarning: combinedTurnstileWarning ?? (!emailRedirectTo ? "Kayit yonlendirmesi hazirlaniyor." : null),
  });

  const clearErrorState = useCallback(() => {
    setSignupState((current) => {
      if (current.type === "error") {
        return { type: "idle" };
      }
      return current;
    });
  }, []);

  // PRODUCTION-SAFE: Centralized reset that clears ALL token state
  const triggerReset = useCallback(() => {
    // SINGLE SOURCE OF TRUTH: Clear token lifecycle
    tokenLifecycleRef.current = { type: "empty" };

    // Clear timeout
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }

    // Reset UI state
    setTurnstileStatus("expired");
    setResetCounter((prev) => prev + 1);

    // If we were in an error state, go back to idle
    setSignupState((current) => {
      if (current.type === "error") {
        return { type: "idle" };
      }
      return current;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }
    };
  }, []);

  // PRODUCTION-SAFE: Handle token changes with single source of truth
  const handleTurnstileTokenChange = useCallback((value: string | null) => {
    // Clear any error state when token changes (user is interacting)
    clearErrorState();

    if (value) {
      const now = Date.now();
      const expiresAt = now + TURNSTILE_TOKEN_MAX_AGE_MS;

      // SINGLE SOURCE OF TRUTH: Set token lifecycle
      tokenLifecycleRef.current = { type: "available", token: value, expiresAt };

      // Clear any existing timeout
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
      }

      // Set new timeout - BUT check if request is in flight before resetting
      expiryTimeoutRef.current = setTimeout(() => {
        const lifecycle = tokenLifecycleRef.current;

        // CRITICAL FIX: Only reset if NOT currently in a request
        // If a request is in flight, let it complete - the error handler will deal with it
        if (lifecycle.type === "consumed") {
          if (process.env.NODE_ENV === "development") {
            console.debug("[signup.turnstile] Token expired but request in flight - deferring reset.");
          }
          // Mark as expired but don't reset yet - the request completion will handle it
          tokenLifecycleRef.current = {
            type: "expired",
            previousToken: lifecycle.token,
            expiredAt: Date.now(),
          };
          return;
        }

        if (process.env.NODE_ENV === "development") {
          console.debug("[signup.turnstile] Token expired via timeout.");
        }

        // Only reset UI if we're not submitting
        setSignupState((current) => {
          if (current.type === "idle" || current.type === "error") {
            return {
              type: "error",
              error: "token_expired",
              shouldResetTurnstile: true,
              userMessage: "Doğrulama süresi doldu. Lütfen güvenlik kontrolünü tekrar tamamlayın.",
            };
          }
          return current;
        });

        tokenLifecycleRef.current = { type: "empty" };
        setTurnstileStatus("expired");
        setResetCounter((prev) => prev + 1);
      }, TURNSTILE_TOKEN_MAX_AGE_MS);

      if (process.env.NODE_ENV === "development") {
        console.debug("[signup.turnstile] Token received.", {
          tokenLength: value.length,
          expiresAt: new Date(expiresAt).toISOString(),
        });
      }
    } else {
      // Token cleared - reset lifecycle
      tokenLifecycleRef.current = { type: "empty" };
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
        expiryTimeoutRef.current = null;
      }
    }
  }, [clearErrorState]);

  const handleTurnstileWarningChange = useCallback((value: string | null) => {
    clearErrorState();
    setTurnstileRuntimeWarning((currentValue) => (currentValue === value ? currentValue : value));
  }, [clearErrorState]);

  const handleTurnstileStatusChange = useCallback((value: TurnstileWidgetStatus) => {
    clearErrorState();
    setTurnstileStatus((currentValue) => (currentValue === value ? currentValue : value));
  }, [clearErrorState]);

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

  // PRODUCTION-SAFE: Submit handler with state machine and hard lock
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // HARD LOCK: Check state machine FIRST - no race condition possible
    const currentState = signupState;
    if (currentState.type !== "idle" && currentState.type !== "error") {
      // Already submitting - ignore
      return;
    }

    // Clear previous error state
    if (currentState.type === "error") {
      setSignupState({ type: "idle" });
    }

    // Validate cooldown
    if (isCooldownActive) {
      setSignupState({
        type: "error",
        error: "cooldown_active",
        shouldResetTurnstile: false,
        userMessage: `${cooldownRemainingSeconds} saniye sonra tekrar deneyin.`,
      });
      return;
    }

    // Validate form
    if (validationMessage) {
      setSignupState({
        type: "error",
        error: "validation_failed",
        shouldResetTurnstile: false,
        userMessage: validationMessage,
      });
      return;
    }

    // Validate token availability and expiry
    const lifecycle = tokenLifecycleRef.current;
    if (lifecycle.type !== "available") {
      setSignupState({
        type: "error",
        error: "token_unavailable",
        shouldResetTurnstile: true,
        userMessage: "Lütfen bot doğrulamasını tamamlayın.",
      });
      return;
    }

    const now = Date.now();
    if (now > lifecycle.expiresAt) {
      tokenLifecycleRef.current = { type: "expired", previousToken: lifecycle.token, expiredAt: now };
      setSignupState({
        type: "error",
        error: "token_expired",
        shouldResetTurnstile: true,
        userMessage: "Güvenlik doğrulamasının süresi doldu. Lütfen tekrar doğrulayın.",
      });
      return;
    }

    // CONSUME TOKEN - mark as in-use with request ID
    const requestId = generateRequestId();
    tokenLifecycleRef.current = { type: "consumed", token: lifecycle.token, usedAt: now, requestId };

    if (process.env.NODE_ENV === "development") {
      console.debug("[signup] Starting submission.", {
        requestId,
        tokenLength: lifecycle.token.length,
        expiresIn: Math.round((lifecycle.expiresAt - now) / 1000),
      });
    }

    // Transition to captcha verification state
    setSignupState({ type: "verifying_captcha", token: lifecycle.token, requestId });

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
          turnstileToken: lifecycle.token,
          requestId, // Send request ID for correlation
        }),
      });

      const result = (await response.json().catch(() => null)) as SignupApiErrorResponse | SignupApiSuccessResponse | null;
      const errorResult = result && "error" in result ? result : null;
      const successResult =
        result && "ok" in result && result.ok && result.verified === true ? result : null;

      if (!response.ok || !successResult) {
        // Handle rate limiting
        if (response.status === 429 || errorResult?.error === RATE_LIMITED_ERROR || errorResult?.error === EMAIL_RATE_LIMITED_ERROR) {
          startSignupCooldown();
        }

        // Check if we need to reset turnstile
        const shouldResetTurnstile =
          errorResult?.error === TURNSTILE_FAILED_ERROR ||
          errorResult?.details?.shouldResetTurnstile === true;

        if (shouldResetTurnstile) {
          if (process.env.NODE_ENV === "development") {
            console.debug("[signup] Backend requested Turnstile reset.", {
              error: errorResult?.error,
            });
          }
          triggerReset();
        }

        // Show real backend error message
        const backendError = errorResult?.message || errorResult?.error;
        const userMessage =
          getSignupErrorMessage(errorResult?.error, backendError, errorResult?.turnstile) ??
          errorResult?.message ??
          "Kayıt işlemi tamamlanamadı. Lütfen tekrar deneyin.";

        // RESET TOKEN so user can retry
        tokenLifecycleRef.current = { type: "empty" };
        if (expiryTimeoutRef.current) {
          clearTimeout(expiryTimeoutRef.current);
          expiryTimeoutRef.current = null;
        }

        setSignupState({
          type: "error",
          error: errorResult?.error || "unknown_error",
          shouldResetTurnstile,
          userMessage,
        });
        return;
      }

      // SUCCESS: User created - show success regardless of email status
      // Email is sent asynchronously in background (status: "queued")
      console.log("SIGNUP_SUCCESS", { emailStatus: successResult.emailStatus, userId: successResult.userId });

      const emailStatus = successResult.emailStatus ?? "queued";
      const isEmailFailed = emailStatus === "failed";

      // Build user message based on email status
      let userMessage: string;
      if (isEmailFailed) {
        userMessage = "Hesabınız oluşturuldu ancak doğrulama e-postası gönderilemedi. Lütfen giriş yapmayı deneyin veya destek ile iletişime geçin.";
      } else if (emailStatus === "queued") {
        userMessage = "Hesabınız başarıyla oluşturuldu! Doğrulama e-postası gönderiliyor, lütfen birkaç dakika içinde gelen kutunuzu kontrol edin.";
      } else {
        userMessage = successResult.message ?? emailVerificationSentMessage;
      }

      setSignupState({
        type: "success",
        emailStatus,
        userMessage,
      });

      // Show appropriate toast
      if (typeof window !== "undefined" && (window as unknown as { showToast?: (msg: string, type: string) => void }).showToast) {
        const toastMessage = isEmailFailed
          ? "Hesabınız oluşturuldu ancak doğrulama maili gönderilemedi."
          : "Hesabınız başarıyla oluşturuldu! Doğrulama e-postası gönderildi.";
        (window as unknown as { showToast: (msg: string, type: string) => void }).showToast(
          toastMessage,
          isEmailFailed ? "warning" : "success"
        );
      }

      // Navigate to verification page for all success cases (even if email failed)
      router.push(buildEmailVerificationPath(email, null, { emailSent: !isEmailFailed }));
    } catch (error) {
      // RESET TOKEN on any error so user can retry
      tokenLifecycleRef.current = { type: "empty" };
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
        expiryTimeoutRef.current = null;
      }

      const userMessage = abortController.signal.aborted
        ? "Kayıt isteği zaman aşımına uğradı. Lütfen tekrar deneyin."
        : `Kayıt hatası: ${error instanceof Error ? error.message : "Beklenmeyen bir ağ hatası oluştu."}`;

      setSignupState({
        type: "error",
        error: "request_failed",
        shouldResetTurnstile: true,
        userMessage,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const isSubmitDisabled = isSubmitting || isCooldownActive || Boolean(validationMessage);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
      </div>

      <div className="relative mx-auto w-full max-w-md px-4 lg:max-w-4xl lg:px-8">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1fr]">
          <section className="premium-panel p-4 sm:p-6">
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

          <section className="premium-panel p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Kayit Ol</h2>
          <p className="mt-2 text-sm text-slate-300">Ad, soyad, e-posta, sifre ve yasal onaylarla yeni hesabinizi guvenle olusturun.</p>

          <form onSubmit={onSubmit} className="mt-4 sm:mt-6 space-y-3 sm:space-y-4" data-testid="register-form">
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-300">Ad</span>
                <input
                  autoComplete="given-name"
                  className={inputClassName}
                  name="firstName"
                  onChange={(event) => {
                    clearErrorState();
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
                    clearErrorState();
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
                  clearErrorState();
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
                  clearErrorState();
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
                  clearErrorState();
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
                  clearErrorState();
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
                  clearErrorState();
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
      </div>
    </main>
  );
}
