import Link from "next/link";

export default function KvkkPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <article className="premium-panel p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AssetCare</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">KVKK Aydınlatma Metni</h1>
        <p className="mt-2 text-sm text-slate-300">Son güncelleme: 16 Şubat 2026</p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Veri Sorumlusu</h2>
            <p className="mt-2">
              6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, AssetCare hizmeti veri sorumlusu sıfatıyla
              kişisel verilerinizi işler.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. İşlenen Kişisel Veriler</h2>
            <p className="mt-2">
              Kimlik ve iletişim bilgileri, kullanıcı hesabı verileri, işlem güvenliği kayıtları ve hizmet kullanımı
              sırasında girilen operasyonel veriler işlenebilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. İşleme Amaçları ve Hukuki Sebep</h2>
            <p className="mt-2">
              Sözleşmenin kurulması/ifası, yasal yükümlülüklerin yerine getirilmesi, hizmet kalitesinin artırılması ve
              bilgi güvenliği süreçlerinin yürütülmesi amacıyla veri işlenir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Veri Aktarımı</h2>
            <p className="mt-2">
              Veriler, yalnızca yasal yükümlülükler veya hizmetin teknik gerekliliği ölçüsünde, ilgili mevzuata uygun
              şekilde yetkili taraflarla paylaşılabilir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Haklarınız</h2>
            <p className="mt-2">
              KVKK’nın 11. maddesi kapsamındaki erişim, düzeltme, silme, itiraz ve başvuru haklarınızı kullanabilirsiniz.
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
