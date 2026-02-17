import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="premium-panel p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AssetCare</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Kullanım Koşulları</h1>
        <p className="mt-2 text-sm text-slate-300">Son güncelleme: 16 Şubat 2026</p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Hizmet Kapsamı</h2>
            <p className="mt-2">
              AssetCare; varlık yönetimi, bakım planlama, servis kayıtları, belge yönetimi ve maliyet/abonelik izleme
              amacıyla sunulan bir SaaS hizmetidir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Kullanıcı Sorumlulukları</h2>
            <p className="mt-2">
              Kullanıcı, sisteme girilen verilerin doğruluğundan sorumludur. Hesap erişim bilgilerinin güvenliğini
              sağlamak kullanıcı yükümlülüğündedir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Yasaklı Kullanımlar</h2>
            <p className="mt-2">
              Hukuka aykırı içerik yükleme, yetkisiz erişim girişimi, sistemi bozma veya üçüncü kişi verilerine izinsiz
              erişim kesinlikle yasaktır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Hizmet Sürekliliği</h2>
            <p className="mt-2">
              Hizmetin kesintisiz olması hedeflenir; ancak bakım, güvenlik veya altyapı çalışmaları nedeniyle planlı
              kesintiler olabilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Değişiklik Hakkı</h2>
            <p className="mt-2">
              AssetCare, bu koşulları mevzuat veya hizmet ihtiyaçlarına göre güncelleyebilir. Güncel metin web
              sayfasında yayımlandığı anda geçerlilik kazanır.
            </p>
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
