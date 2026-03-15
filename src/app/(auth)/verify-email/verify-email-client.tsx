"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { isEmailRateLimitError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";
import {
  emailVerificationCompletedMessage,
  emailVerificationPromptMessage,
  emailVerificationResentMessage,
  getEmailVerificationRedirectUrl,
} from "@/lib/supabase/email-verification";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const allowedVerificationTypes = new Set(["signup", "email"]);

type MessageTone = "error" | "info";

export default function VerifyEmailClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedLinkRef = useRef(false);

  const email = (searchParams.get("email") ?? "").trim();
  const tokenHash = (searchParams.get("token_hash") ?? "").trim();
  const verificationType = (searchParams.get("type") ?? "signup").trim();

  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [{ text: message, tone: messageTone }, setFeedback] = useState({
    text: emailVerificationPromptMessage,
    tone: "info" as MessageTone,
  });

  const redirectToLogin = async (resolvedEmail?: string | null) => {
    await supabase.auth.signOut();

    const params = new URLSearchParams({
      email_verified: "1",
    });

    const normalizedEmail = resolvedEmail?.trim();
    if (normalizedEmail) {
      params.set("email", normalizedEmail);
    }

    router.replace(`/login?${params.toString()}`);
  };

  useEffect(() => {
    if (!tokenHash || processedLinkRef.current || !allowedVerificationTypes.has(verificationType)) {
      return;
    }

    processedLinkRef.current = true;
    setFeedback({
      text: "E-posta doğrulaması tamamlanıyor...",
      tone: "info",
    });

    let isActive = true;

    void (async () => {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: verificationType as "email" | "signup",
      });

      if (!isActive) {
        return;
      }

      if (error) {
        setFeedback({
          text: error.message || "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir kod isteyin.",
          tone: "error",
        });
        return;
      }

      setFeedback({
        text: emailVerificationCompletedMessage,
        tone: "info",
      });

      await supabase.auth.signOut();

      const params = new URLSearchParams({
        email_verified: "1",
      });

      const resolvedEmail = (data.user?.email ?? email).trim();
      if (resolvedEmail) {
        params.set("email", resolvedEmail);
      }

      router.replace(`/login?${params.toString()}`);
    })();

    return () => {
      isActive = false;
    };
  }, [email, router, supabase, tokenHash, verificationType]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback({ text: "", tone: "info" });

    const normalizedCode = verificationCode.replace(/\s+/g, "");

    if (!email) {
      setFeedback({
        text: "Doğrulama kodunu girebilmek için önce kayıt akışından gelmeniz gerekiyor.",
        tone: "error",
      });
      return;
    }

    if (!normalizedCode) {
      setFeedback({
        text: "Doğrulama kodu zorunludur.",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: normalizedCode,
        type: "signup",
      });

      if (error) {
        setFeedback({
          text: error.message || "Doğrulama kodu geçersiz veya süresi dolmuş.",
          tone: "error",
        });
        return;
      }

      setFeedback({
        text: emailVerificationCompletedMessage,
        tone: "info",
      });

      await redirectToLogin(data.user?.email ?? email);
    } catch {
      setFeedback({
        text: "Doğrulama sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendVerification = async () => {
    if (!email) {
      setFeedback({
        text: "Yeni kod gönderebilmek için e-posta adresi gerekli.",
        tone: "error",
      });
      return;
    }

    setIsResendingVerification(true);
    setFeedback({ text: "", tone: "info" });

    try {
      const emailRedirectTo = getEmailVerificationRedirectUrl();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
      });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setFeedback({
            text: "E-posta limiti aşıldı. Lütfen kısa bir süre sonra tekrar deneyin.",
            tone: "error",
          });
          return;
        }

        setFeedback({
          text: error.message || "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.",
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
        text: "Doğrulama e-postası gönderilirken beklenmeyen bir hata oluştu.",
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
              Kod gönderilen adres: <span className="font-semibold text-white">{email}</span>
            </p>
          ) : null}
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Doğrulama Kodunu Gir</h2>
          <p className="mt-2 text-sm text-slate-300">
            E-postanızdaki kodu girin veya isterseniz aynı ekrandan yeni bir kod isteyin.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="verify-email-form">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Doğrulama Kodu</span>
              <input
                type="text"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                className={inputClassName}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                data-testid="verify-email-code-input"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="verify-email-submit"
            >
              {isSubmitting ? "Kod doğrulanıyor..." : "E-postamı Doğrula"}
            </button>

            <button
              type="button"
              onClick={onResendVerification}
              disabled={isResendingVerification || !email}
              className="w-full rounded-full border border-sky-300/40 px-5 py-2.5 text-sm font-semibold text-sky-200 transition hover:border-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="verify-email-resend"
            >
              {isResendingVerification ? "Yeni kod gönderiliyor..." : "Yeni doğrulama kodu gönder"}
            </button>

            {message ? (
              <p
                className={messageTone === "info" ? "text-sm text-sky-200" : "text-sm text-rose-200"}
                data-testid="verify-email-message"
              >
                {message}
              </p>
            ) : null}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Hesabınız zaten doğrulandıysa{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              giriş yapın
            </Link>
            .
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Doğrulama bağlantısından geldiyseniz sayfa otomatik olarak doğrulamayı tamamlar.
          </p>
        </section>
      </div>
    </main>
  );
}
