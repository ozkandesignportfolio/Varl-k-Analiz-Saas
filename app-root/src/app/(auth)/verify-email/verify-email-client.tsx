"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { isEmailRateLimitError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";

const emailVerificationPromptMessage =
  "E-posta adresinizi dogrulamak icin gelen kutunuzu kontrol edin.";

const emailVerificationSentMessage =
  "E-posta adresinize dogrulama baglantisi gonderildi.";

const emailVerificationResentMessage =
  "Dogrulama e-postasi tekrar gonderildi.";

const invalidVerificationLinkMessage =
  "Dogrulama baglantisi gecersiz veya suresi dolmus. Lutfen yeni bir baglanti isteyin.";

type MessageTone = "error" | "info" | "success";

type VerifyEmailClientProps = {
  emailRedirectTo: string;
};

/**
 * VerifyEmailClient - UI ONLY
 *
 * This component handles:
 * 1. Showing "check your email" message after signup
 * 2. Manual verification resend
 * 3. Displaying errors from failed callback attempts
 *
 * NOTE: All authentication processing is handled by /auth/callback.
 * This component does NOT process code/token_hash - it's UI only.
 */
export default function VerifyEmailClient({ emailRedirectTo }: VerifyEmailClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const email = (searchParams.get("email") ?? "").trim();
  const hasSentState = searchParams.get("sent") === "1";

  // Handle errors passed from callback route
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const redirectErrorMessage = errorDescription ?? errorParam ?? "";

  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [{ text: message, tone: messageTone }, setFeedback] = useState(() => {
    // If there's an error from callback, show it
    if (redirectErrorMessage) {
      return {
        text: redirectErrorMessage === "invalid_or_expired"
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
        } else {
          setFeedback({
            text: error.message || "Dogrulama baglantisi gonderilemedi. Lutfen tekrar deneyin.",
            tone: "error",
          });
        }
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
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">E-posta Doğrulama</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{emailVerificationPromptMessage}</p>
          {email ? (
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Bağlantı gönderilen adres: <span className="font-semibold text-white">{email}</span>
            </p>
          ) : null}
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Bağlantınızı Kontrol Edin</h2>
          <p className="mt-2 text-sm text-slate-300">
            Bu ekranda kod girmeniz gerekmez. E-postanızdaki doğrulama bağlantısına tıkladığınızda
            hesabınıza güvenli şekilde yönlendirilirsiniz.
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
              ? "Doğrulama bağlantısı gönderiliyor..."
              : "Doğrulama bağlantısını tekrar gönder"}
          </button>

          <p className="mt-5 text-sm text-slate-300">
            Hesabınız zaten doğrulandıysa{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              giriş yapın
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
