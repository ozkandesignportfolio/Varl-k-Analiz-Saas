"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { isEmailRateLimitError, isInvalidEmailVerificationError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import {
  buildLoginPath,
  emailVerificationCompletedMessage,
  emailVerificationPromptMessage,
  emailVerificationResentMessage,
  emailVerificationSentMessage,
  invalidVerificationLinkMessage,
} from "@/lib/supabase/email-verification";

const allowedVerificationTypes = new Set(["signup", "email"]);
const emailVerificationProcessingMessage = "Dogrulama baglantisi kontrol ediliyor...";

type MessageTone = "error" | "info" | "success";

const getSafeNextPath = (candidate: string | null) => {
  if (!candidate) {
    return "/dashboard";
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }

  return candidate;
};

type VerifyEmailClientProps = {
  emailRedirectTo: string;
};

/**
 * VerifyEmailClient
 * 
 * NOTE: Email verification callbacks are now handled by /auth/callback route.
 * This component is for:
 * 1. Showing "check your email" message after signup
 * 2. Manual verification resend
 * 3. Displaying errors from failed callback attempts
 * 4. Backwards compatibility for old verification links (legacy token_hash handling)
 */
export default function VerifyEmailClient({ emailRedirectTo }: VerifyEmailClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHandlingRedirectRef = useRef(false);
  const isRedirectingRef = useRef(false);

  const email = (searchParams.get("email") ?? "").trim();
  // Legacy: code and token_hash are now handled by /auth/callback
  // Kept here for backwards compatibility with old email links
  const authCode = (searchParams.get("code") ?? "").trim();
  const tokenHash = (searchParams.get("token_hash") ?? "").trim();
  const verificationType = (searchParams.get("type") ?? "signup").trim();
  const hasSentState = searchParams.get("sent") === "1";
  const nextPath = useMemo(() => getSafeNextPath(searchParams.get("next")), [searchParams]);
  
  // Handle errors passed from callback route or Supabase
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirectErrorMessage = errorDescription ?? errorParam ?? "";

  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [{ text: message, tone: messageTone }, setFeedback] = useState(() => {
    // If there's an error from callback, show it
    if (redirectErrorMessage) {
      return {
        text: isInvalidEmailVerificationError({ message: redirectErrorMessage })
          ? invalidVerificationLinkMessage
          : redirectErrorMessage,
        tone: "error" as MessageTone,
      };
    }
    return {
      text: hasSentState ? emailVerificationSentMessage : emailVerificationPromptMessage,
      tone: "info" as MessageTone,
    };
  });

  // Handle legacy verification (code/token_hash in URL) - for backwards compatibility
  useEffect(() => {
    let isActive = true;

    const redirectToNextPath = () => {
      if (isRedirectingRef.current) {
        return;
      }

      isRedirectingRef.current = true;
      setFeedback({
        text: `${emailVerificationCompletedMessage} Yonlendiriliyorsunuz...`,
        tone: "success",
      });
      router.replace(nextPath);
      router.refresh();
    };

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!isActive || !data.session) {
        return false;
      }

      redirectToNextPath();
      return true;
    };

    const redirectToLoginSuccess = () => {
      if (isRedirectingRef.current) {
        return;
      }

      isRedirectingRef.current = true;
      router.replace(buildLoginPath(nextPath, { emailVerified: true }));
      router.refresh();
    };

    const handleLegacyVerification = async () => {
      // Skip if already handled or no legacy params
      if (isHandlingRedirectRef.current || (!authCode && !tokenHash)) {
        return;
      }

      // Skip if there's an error already displayed
      if (redirectErrorMessage) {
        return;
      }

      // If already have session, just redirect
      if (await syncSession()) {
        return;
      }

      // Handle legacy code exchange (old email links)
      if (authCode) {
        isHandlingRedirectRef.current = true;
        setFeedback({
          text: emailVerificationProcessingMessage,
          tone: "info",
        });

        const { error } = await supabase.auth.exchangeCodeForSession(authCode);

        if (!isActive) {
          return;
        }

        if (error) {
          setFeedback({
            text: isInvalidEmailVerificationError(error) ? invalidVerificationLinkMessage : error.message || invalidVerificationLinkMessage,
            tone: "error",
          });
          return;
        }

        if (!(await syncSession())) {
          redirectToLoginSuccess();
        }
        return;
      }

      // Handle legacy token_hash verification (old email links)
      if (tokenHash) {
        if (!allowedVerificationTypes.has(verificationType)) {
          setFeedback({
            text: invalidVerificationLinkMessage,
            tone: "error",
          });
          return;
        }

        isHandlingRedirectRef.current = true;
        setFeedback({
          text: emailVerificationProcessingMessage,
          tone: "info",
        });

        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: verificationType as "email" | "signup",
        });

        if (!isActive) {
          return;
        }

        if (error) {
          setFeedback({
            text: isInvalidEmailVerificationError(error) ? invalidVerificationLinkMessage : error.message || invalidVerificationLinkMessage,
            tone: "error",
          });
          return;
        }

        if (!(await syncSession())) {
          redirectToLoginSuccess();
        }
      }
    };

    void handleLegacyVerification();

    // Also listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session || !isActive) {
          return;
        }

        redirectToNextPath();
      },
    );

    return () => {
      isActive = false;
      listener.subscription.unsubscribe();
    };
  }, [authCode, nextPath, redirectErrorMessage, router, supabase, tokenHash, verificationType]);

  const onResendVerification = async () => {
    if (!email) {
      setFeedback({
        text: "Yeni baglanti gonderebilmek icin e-posta adresi gerekli.",
        tone: "error",
      });
      return;
    }

    setIsResendingVerification(true);
    setFeedback({ text: "", tone: "info" });

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setFeedback({
            text: "E-posta limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin.",
            tone: "error",
          });
          return;
        }

        setFeedback({
          text: error.message || "Dogrulama baglantisi gonderilemedi. Lutfen tekrar deneyin.",
          tone: "error",
        });
        return;
      }

      setFeedback({
        text: emailVerificationResentMessage,
        tone: "info",
      });
    } catch {
      setFeedback({
        text: "Dogrulama baglantisi gonderilirken beklenmeyen bir hata olustu.",
        tone: "error",
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8" data-testid="verify-email-root">
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
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">E-posta Dogrulama</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{emailVerificationPromptMessage}</p>
          {email ? (
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Baglanti gonderilen adres: <span className="font-semibold text-white">{email}</span>
            </p>
          ) : null}
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Baglantiyi Kontrol Edin</h2>
          <p className="mt-2 text-sm text-slate-300">
            Bu ekranda kod girmeniz gerekmez. E-postanizdaki dogrulama baglantisina tikladiginizda
            hesabiniza guvenli sekilde yonlendirilirsiniz.
          </p>

          {message ? (
            <p
              className={`mt-6 text-sm ${
                messageTone === "success"
                  ? "text-emerald-200"
                  : messageTone === "info"
                    ? "text-sky-200"
                    : "text-rose-200"
              }`}
              data-testid="verify-email-message"
            >
              {message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onResendVerification}
            disabled={isResendingVerification || !email}
            className="mt-6 w-full rounded-full border border-sky-300/40 px-5 py-2.5 text-sm font-semibold text-sky-200 transition hover:border-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
            data-testid="verify-email-resend"
          >
            {isResendingVerification
              ? "Dogrulama baglantisi gonderiliyor..."
              : "Dogrulama baglantisini tekrar gonder"}
          </button>

          <p className="mt-5 text-sm text-slate-300">
            Hesabiniz zaten dogrulandiysa{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              giris yapin
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
