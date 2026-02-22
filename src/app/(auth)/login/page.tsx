"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  isDevelopmentEnvironment,
  isEmailNotConfirmedError,
  isEmailRateLimitError,
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

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/dashboard";
    return getSafeNextPath(new URLSearchParams(window.location.search).get("next"));
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setMessage("E-posta ve şifre zorunludur.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setMessage("E-posta limiti aşıldı. Lütfen kısa bir süre sonra tekrar deneyin.");
          return;
        }

        if (isEmailNotConfirmedError(error)) {
          if (isDevelopmentEnvironment()) {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (data.session || session) {
              router.push(nextPath);
              router.refresh();
              return;
            }
          }

          setMessage("E-posta adresiniz henüz onaylanmamis. Lütfen e-postanizi onaylayip tekrar deneyin.");
          return;
        }

        setMessage(error.message || "Giriş yapilamadi. Lütfen tekrar deneyin.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setMessage("Giriş sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            AssetCare
          </Link>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] text-white">
            Hesabınıza
            <br />
            giriş yapın
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Varlıklarınızı, servis kayıtlarınızı ve maliyet analizlerinizi gerçek verilerle yönetin.
          </p>
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Giriş Yap</h2>
          <p className="mt-2 text-sm text-slate-300">Devam etmek için hesabınıza giriş yapın.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">E-posta</span>
              <input name="email" type="email" required className={inputClassName} placeholder="ornek@mail.com" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Şifre</span>
              <input name="password" type="password" required className={inputClassName} placeholder="********" />
            </label>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-semibold text-sky-200">
                Şifremi unuttum
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>

            {message ? <p className="text-sm text-rose-200">{message}</p> : null}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Hesabınız yok mu?{" "}
            <Link href="/register" className="font-semibold text-sky-200">
              Kayıt ol
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}



