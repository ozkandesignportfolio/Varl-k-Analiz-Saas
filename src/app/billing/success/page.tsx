import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-white">Ödeme başarılı</h1>
      <p className="mt-3 text-sm text-slate-300">
        Abonelik işleminiz alındı. Planınız webhook tamamlandığında Premium olarak güncellenecek.
      </p>
      <Link
        href="/settings"
        className="mt-6 inline-flex rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
      >
        Ayarlara dön
      </Link>
    </main>
  );
}
