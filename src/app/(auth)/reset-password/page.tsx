"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
    };

    void syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (password.length < 6) {
      setMessage("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Şifreler eşleşmiyor.");
      return;
    }

    if (!hasSession) {
      setMessage("Geçerli bir sıfırlama oturumu bulunamadı. E-postadaki bağlantıyı tekrar açın.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz...");
    setIsSubmitting(false);
    setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1200);
  };

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <section className="premium-panel p-6">
          <h1 className="text-2xl font-semibold text-white">Yeni Şifre Belirle</h1>
          <p className="mt-2 text-sm text-slate-300">
            E-posta bağlantısı ile açıldıysa aşağıdan yeni şifrenizi oluşturabilirsiniz.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Yeni Şifre</span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                className={inputClassName}
                placeholder="En az 6 karakter"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Yeni Şifre Tekrar</span>
              <input
                name="passwordConfirm"
                type="password"
                required
                minLength={6}
                className={inputClassName}
                placeholder="Şifrenizi tekrar girin"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting || hasSession === false}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </button>
          </form>

          {hasSession === false ? (
            <p className="mt-4 text-sm text-amber-200">
              Sıfırlama oturumu bulunamadı. Lütfen e-posta ile gelen bağlantıdan tekrar giriş yapın.
            </p>
          ) : null}

          {message ? <p className="mt-4 text-sm text-slate-200">{message}</p> : null}

          <p className="mt-5 text-sm text-slate-300">
            Giriş ekranına dönmek için{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              tıklayın
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

