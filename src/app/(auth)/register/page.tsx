"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { getPlanConfig } from "@/lib/plans/plan-config";
import { getAuthRedirectUrl } from "@/lib/supabase/auth-redirect";
import { isEmailNotConfirmedError, isEmailRateLimitError } from "@/lib/supabase/auth-errors";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const trialPlan = getPlanConfig("starter");
const trialAssetLimit = trialPlan.limits.assetsLimit ?? 0;
const trialDocumentLimit = trialPlan.limits.documentsLimit ?? 0;
const trialSubscriptionLimit = trialPlan.limits.subscriptionsLimit ?? 0;
const trialInvoiceUploadLimit = trialPlan.limits.invoiceUploadsLimit ?? 0;
const verificationMessage = "E-posta doğrulama bağlantısı gönderildi. Gelen kutusu + spam kontrol et.";

export default function RegisterPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;

    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (!fullName || !email || !password) {
      setMessage("Ad soyad, e-posta ve şifre zorunludur.");
      return;
    }

    if (password.length < 6) {
      setMessage("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== passwordConfirm) {
      setMessage("Şifreler eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);

    try {
      const emailRedirectTo = getAuthRedirectUrl("/login?email_verified=1");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        if (isEmailRateLimitError(error)) {
          setMessage("E-posta limiti aşıldı. Lütfen kısa bir süre sonra tekrar deneyin.");
          return;
        }

        if (isEmailNotConfirmedError(error)) {
          setMessage("Hesap oluşturuldu ancak e-posta onayı gerekiyor. E-posta kutunuzu kontrol edin.");
          return;
        }

        setMessage(error.message || "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.");
        return;
      }

      await supabase.auth.signOut();

      if (data.session) {
        setMessage(verificationMessage);
        router.push(`/login?email_verification_required=1&email=${encodeURIComponent(email)}`);
        return;
      }

      if (data.user) {
        setMessage(verificationMessage);
        router.push(`/login?email_verification_required=1&email=${encodeURIComponent(email)}`);
        return;
      }

      setMessage("E-postanı doğrula, sonra giriş yap.");
      router.push(`/login?email_verification_required=1&email=${encodeURIComponent(email)}`);
    } catch {
      setMessage("Kayıt sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
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
            Hesabınızı oluşturun
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Deneme planında {trialAssetLimit} varlık, {trialDocumentLimit} belge, {trialSubscriptionLimit} abonelik ve{" "}
            {trialInvoiceUploadLimit} fatura yükleme ile başlayın. İstediğiniz zaman 149 TL premium plana geçin.
          </p>
        </section>

        <section className="premium-panel p-6">
          <h2 className="text-2xl font-semibold text-white">Kayıt Ol</h2>
          <p className="mt-2 text-sm text-slate-300">Yeni hesabınızı oluşturun.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Ad Soyad</span>
              <input name="fullName" type="text" required className={inputClassName} placeholder="Örnek: Osman Yılmaz" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">E-posta</span>
              <input name="email" type="email" required className={inputClassName} placeholder="örnek@mail.com" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Şifre</span>
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
              <span className="mb-1.5 block text-sm text-slate-300">Şifre Tekrar</span>
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
              disabled={isSubmitting}
              className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
            </button>

            {message ? <p className="text-sm text-slate-200">{message}</p> : null}
          </form>

          <p className="mt-5 text-sm text-slate-300">
            Hesabınız var mı?{" "}
            <Link href="/login" className="font-semibold text-sky-200">
              Giriş yap
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
