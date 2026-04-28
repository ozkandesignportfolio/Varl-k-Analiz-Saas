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
  MISSING_FIELDS_ERROR,
  PASSWORD_MISMATCH_ERROR,
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
import { Runtime } from "@/lib/env/runtime";
import { BarChart3, CreditCard, FileText, Layers, Sparkles, Users } from "lucide-react";

// PRODUCTION-SAFE STATE MACHINE
// Valid states: idle -> verifying_captcha -> creating_user -> sending_email -> success | rollback | error
type SignupState =
  | { type: "idle" }
  | { type: "verifying_captcha"; token: string; requestId: string }
  | { type: "creating_user"; token: string; requestId: string }
  | { type: "sending_email"; userId: string; requestId: string }
  | { type: "success"; emailStatus: "sent" | "failed"; userMessage: string }
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

// UNIFIED SCHEMA: Backend only stores accepted_terms (boolean)
// Frontend still validates both checkboxes separately for legal compliance
// but combines them into single acceptedTerms field for API

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
    normalizedMessage.includes("turnstile server doğrulaması yapılandırılmamış")
  ) {
    return "Güvenlik doğrulaması yapılandırılmamış. Lütfen daha sonra tekrar deneyin veya yöneticiyle iletişime geçin.";
  }

  if (
    normalizedMessage.includes("turnstile verification could not be completed") ||
    normalizedMessage.includes("turnstile doğrulaması tamamlanamadı")
  ) {
    return "Güvenlik doğrulaması şu anda tamamlanamadı. Lütfen tekrar deneyin.";
  }

  if (
    normalizedMessage.includes("turnstile verification failed") ||
    normalizedMessage.includes("turnstile doğrulaması başarısız oldu")
  ) {
    return "Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.";
  }

  if (normalizedMessage.includes("please complete the turnstile verification")) {
    return "Lütfen bot doğrulamasını tamamlayın.";
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
    return "Güvenlik doğrulaması sunucu anahtarı geçersiz. Site yöneticisi Turnstile secret ayarını kontrol etmeli.";
  }

  if (turnstile.errorCodes.includes("invalid-input-response") || turnstile.issue === "token") {
    return "Güvenlik doğrulaması tokeni geçersiz veya süresi dolmuş. Lütfen yeniden doğrulayın.";
  }

  if (turnstile.issue === "env") {
    return "Güvenlik doğrulaması sunucu tarafında yapılandırılmamış. Site yöneticisi env değerlerini kontrol etmeli.";
  }

  if (turnstile.issue === "network") {
    return "Güvenlik doğrulaması şu anda tamamlanamadı. Lütfen tekrar deneyin.";
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
    return "Güvenlik doğrulaması ayarı geçersiz. Lütfen Turnstile env değerlerini kontrol edin.";
  }

  if (!canUseLocalhostTurnstileTestKeys(hostname) && isLocalhostTestTurnstileSiteKey(siteKey)) {
    return "Güvenlik doğrulaması ayarı geçersiz. Production için gerçek Turnstile anahtarlarını tanımlayın.";
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
    return "Lütfen bot doğrulamasını tamamlayın.";
  }

  if (turnstileStatus === "expired") {
    return "Bot doğrulamasının süresi doldu. Lütfen yeniden tamamlayın.";
  }

  if (turnstileStatus === "error") {
    return "Bot doğrulaması başarısız oldu. Lütfen tekrar deneyin.";
  }

  if (turnstileStatus !== "verified") {
    return "Lütfen bot doğrulamasını tamamlayın.";
  }

  return null;
};

const getSignupValidationMessage = (input: SignupFormValidationInput) => {
  if (!input.firstName || !input.lastName || !input.email || !input.password || !input.confirmPassword) {
    return "Ad, soyad, e-posta, şifre ve şifre tekrarı zorunludur.";
  }

  if (!EMAIL_REGEX.test(input.email)) {
    return "Lütfen geçerli bir e-posta adresi girin.";
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;
  }

  if (input.password !== input.confirmPassword) {
    return "Şifre ve şifre tekrarı aynı olmalı.";
  }

  if (!input.acceptedLegalDocuments) {
    return "Lütfen devam etmek için kullanım koşullarını kabul edin.";
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
    [EMAIL_ALREADY_EXISTS_ERROR]: "Bu e-posta ile kayıtlı bir hesabınız var. Giriş yapabilirsiniz.",
    [TURNSTILE_TOKEN_USED_ERROR]: "Bu güvenlik doğrulaması zaten kullanıldı. Lütfen yeniden doğrulayın.",
    [TURNSTILE_FAILED_ERROR]: getTurnstileDiagnosticsMessage(turnstile) ?? "Güvenlik doğrulaması başarısız. Lütfen tekrar deneyin.",
    [EMAIL_RATE_LIMITED_ERROR]: "Çok fazla kayıt denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin.",
    [RATE_LIMITED_ERROR]: "Çok fazla kayıt denemesi yapıldı. Lütfen 1 dakika bekleyip tekrar deneyin.",
    [MISSING_FIELDS_ERROR]: "Lütfen tüm zorunlu alanları doldurun.",
    [PASSWORD_MISMATCH_ERROR]: "Şifre ve şifre tekrarı aynı olmalı.",
    [INVALID_EMAIL_ERROR]: "Lütfen geçerli bir e-posta adresi girin.",
    [INVALID_PASSWORD_ERROR]: `Şifreniz en az ${PASSWORD_MIN_LENGTH} karakter olmalı ve büyük harf, küçük harf, rakam içermeli.`,
    [TERMS_NOT_ACCEPTED_ERROR]: "Kullanım Şartları, Gizlilik Politikası ve KVKK Aydınlatma Metni'ni kabul etmelisiniz.",
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
    <div className="-mx-3 flex w-full justify-center py-5 sm:mx-0 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/5 sm:px-4">
      <div className="max-w-full overflow-visible">
        <TurnstileWidget
          onStatusChange={onStatusChange}
          onTokenChange={onTokenChange}
          onWarningChange={onWarningChange}
          resetTrigger={resetTrigger}
          siteKey={siteKey}
        />
      </div>
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
    const hostname = Runtime.isClient() ? window.location.hostname : null;
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
    if (!Runtime.isClient()) {
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
    acceptedLegalDocuments,
    confirmPassword,
    email,
    firstName,
    lastName,
    password,
    turnstileSiteKey,
    turnstileStatus,
    turnstileToken: currentToken,
    turnstileWarning: combinedTurnstileWarning ?? (!emailRedirectTo ? "Kayıt yönlendirmesi hazırlanıyor." : null),
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
          if (!Runtime.isBuild()) {
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

        if (!Runtime.isBuild()) {
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

      if (!Runtime.isBuild()) {
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
    if (!Runtime.isClient()) {
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

    if (!Runtime.isBuild()) {
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
        // UNIFIED SCHEMA: Only accepted_terms is stored in database
        // Both checkboxes must be checked for acceptedTerms to be true
        body: JSON.stringify({
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

        // ALWAYS reset Turnstile after a failed submit — tokens are single-use.
        // Even if the error is duplicate email, the token was already consumed server-side.
        const shouldResetTurnstile = true;

        if (!Runtime.isBuild()) {
          console.debug("[signup] Resetting Turnstile after failed signup.", {
            error: errorResult?.error,
          });
        }
        triggerReset();

        // Show real backend error message - PRIORITIZE backend message
        const userMessage = errorResult?.message || getSignupErrorMessage(errorResult?.error, undefined, errorResult?.turnstile) || "Kayıt işlemi tamamlanamadı. Lütfen tekrar deneyin.";

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
      // Email is awaited with 10s timeout - actual status returned (sent/failed)
      console.log("SIGNUP_SUCCESS", { emailStatus: successResult.emailStatus, userId: successResult.userId, warnings: successResult.warnings });

      const emailStatus = successResult.emailStatus ?? "failed";
      const isEmailFailed = emailStatus === "failed";
      const emailWarning = successResult.warnings?.find(w => w.includes("Email gönderilemedi"));

      // Build user message based on email status
      let userMessage: string;
      if (isEmailFailed) {
        userMessage = emailWarning
          ? "Hesabınız oluşturuldu ancak doğrulama e-postası gönderilemedi. Lütfen giriş yapmayı deneyin veya destek ile iletişime geçin."
          : "Hesabınız oluşturuldu ancak doğrulama e-postası gönderilemedi. Lütfen giriş yapmayı deneyin veya destek ile iletişime geçin.";
      } else {
        // emailStatus === "sent"
        userMessage = successResult.message ?? emailVerificationSentMessage;
      }

      setSignupState({
        type: "success",
        emailStatus,
        userMessage,
      });

      // Show appropriate toast or alert fallback
      const toastMessage = isEmailFailed
        ? "Hesabınız oluşturuldu ancak doğrulama e-postası gönderilemedi."
        : "Hesabınız başarıyla oluşturuldu! Doğrulama e-postası gönderildi.";
      if (Runtime.isClient() && (window as unknown as { showToast?: (msg: string, type: string) => void }).showToast) {
        (window as unknown as { showToast: (msg: string, type: string) => void }).showToast(
          toastMessage,
          isEmailFailed ? "warning" : "success"
        );
      } else {
        // Fallback to alert if no toast system
        alert(toastMessage);
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
    <main className="relative min-h-screen w-full overflow-x-hidden px-2 py-4 sm:px-4 sm:py-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
      </div>

      <div className="relative mx-auto w-full max-w-md px-0 sm:px-4 lg:max-w-4xl lg:px-8">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1fr]">
          <section className="premium-panel hidden p-3 sm:p-6 lg:flex lg:flex-col lg:justify-between">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-slate-300"
              >
                Assetly
              </Link>
              <h1 className="mt-5 text-2xl font-semibold leading-[1.15] text-white sm:text-3xl">
                Yazılım harcamalarınızı
                <br />
                daha net yönetin
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Deneme planıyla başlayın; varlıkları, belgeleri ve abonelikleri tek yerden takip edin.
                İhtiyaç duyduğunuzda Premium&apos;a geçerek daha fazla kayıt, analiz ve otomasyon özelliği açın.
              </p>

              <ul className="mt-5 space-y-3">
                {([
                  { icon: Layers, title: "Varlıkları tek yerde takip edin", desc: "Abonelikler, araçlar ve ekip kullanımı düzenli bir görünümde." },
                  { icon: CreditCard, title: "Maliyetleri daha net görün", desc: "Aylık giderleri, yenilemeleri ve gereksiz harcamaları kolayca izleyin." },
                  { icon: FileText, title: "Fatura ve belge takibi", desc: "Faturaları, lisans belgelerini ve ödeme kayıtlarını tek alanda saklayın." },
                  { icon: Users, title: "Ekip kullanımını anlayın", desc: "Hangi aracın kim tarafından kullanıldığını daha net değerlendirin." },
                  { icon: BarChart3, title: "Raporlar ve analizler", desc: "Harcama trendlerini ve varlık durumlarını görsel olarak inceleyin." },
                  { icon: Sparkles, title: "Premium'a hazır başlangıç", desc: "Deneme planıyla başlayın, ihtiyaç duyduğunuzda yükseltin." },
                ] as const).map((item) => (
                  <li key={item.title} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-slate-500">
              Ücretsiz planla başlayın — {trialAssetLimit} varlık, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik.
              Premium&apos;a geçiş tamamen sizin kontrolünüzde.
            </p>
          </section>

          <section className="premium-panel p-3 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Kayıt Ol</h2>
          <p className="mt-2 text-sm text-slate-300">Ad, soyad, e-posta, şifre ve yasal onaylarla yeni hesabınızı güvenle oluşturun.</p>

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
                  placeholder="Adınız"
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
                  placeholder="Soyadınız"
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
                  // If we're in an error state (e.g. duplicate email),
                  // also reset Turnstile so user gets a fresh token.
                  setSignupState((current) => {
                    if (current.type === "error") {
                      triggerReset();
                      return { type: "idle" };
                    }
                    return current;
                  });
                  setEmail(event.target.value);
                }}
                placeholder="örnek@mail.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Şifre</span>
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
              <span className="mb-1.5 block text-sm text-slate-300">Şifre Tekrarı</span>
              <input
                autoComplete="new-password"
                className={inputClassName}
                minLength={PASSWORD_MIN_LENGTH}
                name="confirmPassword"
                onChange={(event) => {
                  clearErrorState();
                  setConfirmPassword(event.target.value);
                }}
                placeholder="Şifrenizi tekrar girin"
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <label
                htmlFor="acceptedTerms"
                className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed text-slate-200"
              >
                <input
                  id="acceptedTerms"
                  aria-invalid={signupState.type === "error" && !acceptedLegalDocuments ? true : undefined}
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
                  <Link
                    href="/legal/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sky-400 underline-offset-2 transition hover:underline hover:opacity-80"
                  >
                    Kullanım Koşulları
                  </Link>
                  {" "}ve{" "}
                  <Link
                    href="/legal/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-sky-400 underline-offset-2 transition hover:underline hover:opacity-80"
                  >
                    Gizlilik Politikası
                  </Link>
                  &apos;nı okudum ve kabul ediyorum.
                </span>
              </label>
              {signupState.type === "error" && !acceptedLegalDocuments && (
                <p className="mt-1.5 pl-7 text-xs text-red-400">
                  Lütfen devam etmek için kullanım koşullarını kabul edin.
                </p>
              )}
            </div>

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
              {isSubmitting ? "Hesap Oluşturuluyor..." : isCooldownActive ? `Tekrar deneme: ${cooldownRemainingSeconds}s` : "Kayıt Ol"}
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
                {fingerprintStatus === "ready" && "Cihaz güvenlik sinyalleri hazır."}
                {fingerprintStatus === "loading" && "Cihaz güvenlik sinyalleri arka planda hazırlanıyor."}
                {fingerprintStatus === "fallback" &&
                  "Cihaz parmak izi alınamadı, kayıt işlemi sınırlı güvenlik sinyalleriyle devam edecek."}
              </p>
            )}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              Giriş yap
            </Link>
          </p>
        </section>
        </div>
      </div>
    </main>
  );
}
