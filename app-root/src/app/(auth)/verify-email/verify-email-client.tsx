"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useRef, useState } from "react";

type MessageTone = "error" | "info" | "success";

type VerifyEmailClientProps = {
  emailRedirectTo: string;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] text-white outline-none transition focus:border-sky-400 tabular-nums";

/**
 * VerifyEmailClient - Code-based verification UI
 *
 * After signup the user receives a 6-digit code via e-mail.
 * This component lets them enter the code and verify their account.
 */
export default function VerifyEmailClient({ emailRedirectTo: _emailRedirectTo }: VerifyEmailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = (searchParams.get("email") ?? "").trim();
  const hasSentState = searchParams.get("sent") === "1";

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [{ text: message, tone: messageTone }, setFeedback] = useState<{
    text: string;
    tone: MessageTone;
  }>(() => ({
    text: hasSentState
      ? "E-posta adresinize doğrulama kodu gönderildi."
      : "E-posta adresinize gönderilen 6 haneli doğrulama kodunu girin.",
    tone: "info",
  }));

  const codeInputRef = useRef<HTMLInputElement>(null);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
      setCode(raw);
    },
    [],
  );

  const onSubmitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email) {
      setFeedback({
        text: "E-posta adresi bulunamadı. Lütfen kayıt ekranından tekrar deneyin.",
        tone: "error",
      });
      return;
    }

    if (code.length !== 6) {
      setFeedback({ text: "Lütfen 6 haneli doğrulama kodunu girin.", tone: "error" });
      return;
    }

    setIsVerifying(true);
    setFeedback({ text: "", tone: "info" });

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (response.ok && result?.ok) {
        setFeedback({
          text: result.message ?? "E-posta adresiniz doğrulandı!",
          tone: "success",
        });
        // Redirect to login after short delay
        setTimeout(() => {
          router.push(`/login?email_verified=1&email=${encodeURIComponent(email)}`);
        }, 1500);
        return;
      }

      // Handle specific errors
      setFeedback({
        text: result?.message ?? "Doğrulama başarısız oldu. Lütfen tekrar deneyin.",
        tone: "error",
      });
    } catch {
      setFeedback({
        text: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.",
        tone: "error",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const onResendCode = async () => {
    if (!email) {
      setFeedback({
        text: "Yeni kod gönderebilmek için e-posta adresi gerekli.",
        tone: "error",
      });
      return;
    }

    setIsResending(true);
    setFeedback({ text: "", tone: "info" });

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (result?.error === "already_verified") {
        setFeedback({
          text: "Bu hesap zaten doğrulanmış. Giriş yapabilirsiniz.",
          tone: "success",
        });
        setTimeout(() => {
          router.push(`/login?email_verified=1&email=${encodeURIComponent(email)}`);
        }, 1500);
        return;
      }

      if (response.ok && result?.ok) {
        setFeedback({
          text: result.message ?? "Yeni doğrulama kodu e-posta adresinize gönderildi.",
          tone: "info",
        });
        setCode("");
        codeInputRef.current?.focus();
        return;
      }

      setFeedback({
        text: result?.message ?? "Doğrulama kodu gönderilemedi. Lütfen tekrar deneyin.",
        tone: "error",
      });
    } catch {
      setFeedback({
        text: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.",
        tone: "error",
      });
    } finally {
      setIsResending(false);
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
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Hesabınızı doğrulamak için e-posta adresinize gönderilen 6 haneli kodu girin.
          </p>
          {email ? (
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Kod gönderilen adres: <span className="font-semibold text-white">{email}</span>
            </p>
          ) : null}
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Kodu Girin</h2>
          <p className="mt-2 text-sm text-slate-300">
            E-posta adresinize gönderilen 6 haneli doğrulama kodunu aşağıya girin.
          </p>

          <form onSubmit={onSubmitCode} className="mt-6 space-y-4" data-testid="verify-code-form">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Doğrulama Kodu</span>
              <input
                ref={codeInputRef}
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className={inputClassName}
                placeholder="000000"
                value={code}
                onChange={handleCodeChange}
                data-testid="verify-code-input"
              />
            </label>

            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              data-testid="verify-code-submit"
            >
              {isVerifying ? "Doğrulanıyor..." : "Doğrula"}
            </button>
          </form>

          {message ? (
            <p
              className={`mt-4 text-sm ${
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
            onClick={onResendCode}
            disabled={isResending || !email}
            className="mt-4 w-full rounded-full border border-sky-300/40 px-5 py-2.5 text-sm font-semibold text-sky-200 transition hover:border-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
            data-testid="verify-email-resend"
          >
            {isResending ? "Yeni kod gönderiliyor..." : "Yeni doğrulama kodu gönder"}
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
