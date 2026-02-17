import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="premium-panel p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AssetCare</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Gizlilik Politikası</h1>
        <p className="mt-2 text-sm text-slate-300">Son güncelleme: 16 Şubat 2026</p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Toplanan Veriler</h2>
            <p className="mt-2">
              Hesap bilgileri, varlık kayıtları, bakım/servis logları, yüklenen belgeler ve abonelik/fatura
              kayıtları hizmetin çalışması için işlenir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. İşleme Amacı</h2>
            <p className="mt-2">
              Veriler; varlık yönetimi, bakım planlama, raporlama, güvenlik, hata izleme ve kullanıcı desteği
              amaçlarıyla kullanılır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Güvenlik ve Erişim</h2>
            <p className="mt-2">
              Erişim kontrolü kullanıcı bazlıdır. Yetki politikaları ile kullanıcılar yalnızca kendi kayıtlarına
              erişebilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Saklama Süresi</h2>
            <p className="mt-2">
              Veriler, hizmetin sunumu için gerekli süre boyunca ve ilgili mevzuat yükümlülükleri kapsamında
              saklanır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. İletişim</h2>
            <p className="mt-2">Gizlilik talepleriniz için kayıtlı destek kanalı üzerinden bizimle iletişime geçebilirsiniz.</p>
          </section>
        </div>

        <div className="mt-8">
          <Link href="/" className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-slate-100">
            Ana sayfaya dön
          </Link>
        </div>
      </article>
    </main>
  );
}
