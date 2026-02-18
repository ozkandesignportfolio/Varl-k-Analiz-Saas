import Link from "next/link";

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="premium-panel p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AssetCare</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Çerez Politikası</h1>
        <p className="mt-2 text-sm text-slate-300">Son güncelleme: 16 Şubat 2026</p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Çerez Nedir?</h2>
            <p className="mt-2">
              Çerezler, web uygulamasının düzgün çalışması ve deneyimin iyileştirilmesi için tarayıcıda saklanan küçük
              metin dosyalarıdır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Kullanılan Çerez Türleri</h2>
            <p className="mt-2">
              Oturum yönetimi, güvenlik kontrolleri ve temel performans ölçümleri için zorunlu/işlevsel çerezler
              kullanılabilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Çerezleri Yönetme</h2>
            <p className="mt-2">
              Tarayıcı ayarlarınızdan çerez tercihlerinizi değiştirebilirsiniz. Bazı çerezlerin kapatılması hizmetin
              bazı bölümlerini etkileyebilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Güncellemeler</h2>
            <p className="mt-2">
              Çerez kullanımına ilişkin değişiklikler bu sayfa üzerinden duyurulur ve yayımlandığı tarihten itibaren
              geçerli olur.
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

