import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold text-white">İşlem iptal edildi</h1>
      <p className="mt-3 text-sm text-slate-300">Ödeme tamamlanmadı. Premium planı daha sonra tekrar başlatabilirsiniz.</p>
      <Link
        href="/pricing"
        className="mt-6 inline-flex rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
      >
        Fiyatlandırmaya dön
      </Link>
    </main>
  );
}
