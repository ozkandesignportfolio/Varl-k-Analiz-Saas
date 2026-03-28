"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  emailVerificationCompletedMessage,
  emailVerificationLoginBlockedMessage,
  emailVerificationPromptMessage,
  emailVerificationResentMessage,
} from "@/lib/supabase/email-verification";
import {
  isEmailNotConfirmedError,
  isEmailRateLimitError,
  isSupabaseUserEmailConfirmed,
} from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const getSafeNextPath = (candidate: string | null) => {
  if (!candidate) {
    return "/dashboard";
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/dashboard";
  }

  return candidate;
};

type MessageTone = "error" | "info";

const getInitialMessage = () => {
  if (typeof window === "undefined") {
    return { text: "", tone: "info" as MessageTone };
  }

  const params = new URLSearchParams(window.location.search);

  if (params.get("email_verified") === "1") {
    return { text: emailVerificationCompletedMessage, tone: "info" as MessageTone };
  }

  if (params.get("email_verification_required") === "1") {
    return { text: emailVerificationPromptMessage, tone: "info" as MessageTone };
  }

  return { text: "", tone: "info" as MessageTone };
};

type LoginPageClientProps = {
  emailRedirectTo: string;
};

export default function LoginPageClient({ emailRedirectTo }: LoginPageClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [{ text: message, tone: messageTone }, setFeedback] = useState(getInitialMessage);
  const [verificationEmail, setVerificationEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return (new URLSearchParams(window.location.search).get("email") ?? "").trim();
  });
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/dashboard";
    return getSafeNextPath(new URLSearchParams(window.location.search).get("next"));
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback({ text: "", tone: "info" });

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setFeedback({ text: "E-posta ve sifre zorunludur.", tone: "error" });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setFeedback({ text: "E-posta limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin.", tone: "error" });
          return;
        }

        if (isEmailNotConfirmedError(error)) {
          setVerificationEmail(email);
          setFeedback({ text: emailVerificationLoginBlockedMessage, tone: "error" });
          return;
        }

        setFeedback({ text: error.message || "Giris yapilamadi. Lutfen tekrar deneyin.", tone: "error" });
        return;
      }

      if (!data.session || !data.user) {
        setFeedback({ text: "Giris tamamlanamadi. Lutfen tekrar deneyin.", tone: "error" });
        return;
      }

      if (!isSupabaseUserEmailConfirmed(data.user)) {
        setVerificationEmail(email);
        await supabase.auth.signOut();
        setFeedback({ text: emailVerificationLoginBlockedMessage, tone: "error" });
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setFeedback({ text: "Giris sirasinda beklenmeyen bir hata olustu. Lutfen tekrar deneyin.", tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendVerification = async () => {
    if (!verificationEmail) {
      setFeedback({ text: "Once e-posta adresini girip giris yapmayi deneyin.", tone: "error" });
      return;
    }

    setIsResendingVerification(true);
    setFeedback({ text: "", tone: "info" });

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setFeedback({ text: "E-posta limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin.", tone: "error" });
          return;
        }

        setFeedback({ text: error.message || "Dogrulama e-postasi gonderilemedi. Lutfen tekrar deneyin.", tone: "error" });
        return;
      }

      setFeedback({ text: emailVerificationResentMessage, tone: "info" });
    } catch {
      setFeedback({ text: "Dogrulama e-postasi gonderilirken beklenmeyen bir hata olustu.", tone: "error" });
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8" data-testid="login-root">
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
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">
            Hesabiniza
            <br />
            giris yapin
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Varliklarinizi, servis kayitlarinizi ve maliyet analizlerinizi gercek verilerle yonetin.
          </p>
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Giris Yap</h2>
          <p className="mt-2 text-sm text-slate-300">Devam etmek icin hesabiniza giris yapin.</p>

          <form onSubmit={onSubmit} method="post" className="mt-6 space-y-4" data-testid="login-form">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">E-posta</span>
              <input
                name="email"
                type="email"
                required
                className={inputClassName}
                placeholder="ornek@mail.com"
                defaultValue={verificationEmail || undefined}
                data-testid="login-email"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Sifre</span>
              <input
                name="password"
                type="password"
                required
                className={inputClassName}
                placeholder="********"
                data-testid="login-password"
              />
            </label>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-semibold text-sky-200">
                Sifremi unuttum
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="login-submit"
            >
              {isSubmitting ? "Giris yapiliyor..." : "Giris Yap"}
            </button>

            {verificationEmail ? (
              <button
                type="button"
                onClick={onResendVerification}
                disabled={isResendingVerification}
                className="w-full rounded-full border border-sky-300/40 px-5 py-2.5 text-sm font-semibold text-sky-200 transition hover:border-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="resend-verification-button"
              >
                {isResendingVerification ? "Dogrulama e-postasi gonderiliyor..." : "Dogrulama e-postasini tekrar gonder"}
              </button>
            ) : null}

            {message ? (
              <p
                className={messageTone === "info" ? "text-sm text-sky-200" : "text-sm text-rose-200"}
                data-testid="login-message"
              >
                {message}
              </p>
            ) : null}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Hesabiniz yok mu?{" "}
            <Link href="/register" className="font-semibold text-sky-200">
              Kayit ol
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
