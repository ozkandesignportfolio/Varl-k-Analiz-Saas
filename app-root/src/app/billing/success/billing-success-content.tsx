"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ConfirmStatus = "confirming" | "success" | "error";

const CONFIRM_TIMEOUT_MS = 5_000;

export default function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<ConfirmStatus>("confirming");
  const [errorMessage, setErrorMessage] = useState("");
  const hasStartedRef = useRef(false);

  const confirmSession = useCallback(async (sid: string) => {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CONFIRM_TIMEOUT_MS);

      const res = await fetch("/api/stripe/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
        signal: controller.signal,
      });

      window.clearTimeout(timeout);

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (res.ok && payload?.ok) {
        setStatus("success");
        window.setTimeout(() => router.replace("/settings?checkout=confirmed"), 1_500);
        return;
      }

      setErrorMessage(payload?.error ?? "Premium planı aktifleştirilemedi.");
      setStatus("error");
    } catch {
      setErrorMessage("Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.");
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    if (!sessionId || hasStartedRef.current) return;
    hasStartedRef.current = true;
    void confirmSession(sessionId);
  }, [sessionId, confirmSession]);

  if (!sessionId) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-semibold text-white">Geçersiz oturum</h1>
        <p className="mt-3 text-sm text-slate-300">Checkout oturum bilgisi bulunamadı.</p>
        <Link
          href="/settings"
          className="mt-6 inline-flex rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          Ayarlara dön
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      {status === "confirming" && (
        <>
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <h1 className="text-3xl font-semibold text-white">Ödeme doğrulanıyor</h1>
          <p className="mt-3 text-sm text-slate-300">Lütfen bekleyin, premium üyeliğiniz aktifleştiriliyor...</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-white">Premium üyeliğiniz aktif edildi</h1>
          <p className="mt-3 text-sm text-slate-300">Ayarlar sayfasına yönlendiriliyorsunuz...</p>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-3xl font-semibold text-white">Doğrulama başarısız</h1>
          <p className="mt-3 text-sm text-rose-300">{errorMessage}</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus("confirming");
                setErrorMessage("");
                hasStartedRef.current = false;
                void confirmSession(sessionId);
              }}
              className="inline-flex rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-500/30"
            >
              Tekrar Dene
            </button>
            <Link
              href="/settings"
              className="inline-flex rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Ayarlara dön
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
