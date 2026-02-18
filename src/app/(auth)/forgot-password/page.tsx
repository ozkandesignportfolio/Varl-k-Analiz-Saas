"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      setMessage("E-posta zorunludur.");
      return;
    }

    setIsSubmitting(true);

    const redirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(
      "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.",
    );
    setIsSubmitting(false);
    form.reset();
  };

  return (
    <main className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="ambient-orb ambient-orb-a" />
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <section className="premium-panel p-6">
          <h1 className="text-2xl font-semibold text-white">Şifremi Unuttum</h1>
          <p className="mt-2 text-sm text-slate-300">
            Hesabınızın e-posta adresini girin. Size şifre sıfırlama bağlantısı gönderelim.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">E-posta</span>
              <input
                name="email"
                type="email"
                required
                className={inputClassName}
                placeholder="ornek@mail.com"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
            </button>
          </form>

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

