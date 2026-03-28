import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Assetly",
  description: "Assetly platformunda kişisel verilerin işlenmesine ilişkin gizlilik politikası.",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Assetly Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Gizlilik Politikası</h1>
        <p className="text-sm leading-7 text-slate-300">
          Bu politika, Assetly hizmetini kullanırken işlenen kişisel ve operasyonel verilerin kapsamını,
          işlenme yöntemini ve kullanıcı haklarını açıklar.
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Son güncelleme: 18 Şubat 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="border-l-2 border-indigo-500 pl-4 text-2xl font-semibold text-white">Toplanan Veriler</h2>
        <p className="leading-7 text-slate-300">
          Kayıt sırasında ad-soyad, e-posta, şirket bilgisi ve rol bilgileri alınır. Hizmet kullanımı sırasında varlık
          kayıtları, bakım geçmişi, yüklenen belgeler, fatura verileri ve güvenlik logları oluşur.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-indigo-500 pl-4 text-2xl font-semibold text-white">Kullanım Amacı</h2>
        <p className="leading-7 text-slate-300">
          Veriler; hesap yönetimi, bakım takibi, belge arşivleme, raporlama, abonelik faturalama, güvenlik doğrulama
          ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. Veriler amaç dışı pazarlama profillemesinde
          kullanılmaz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-indigo-500 pl-4 text-2xl font-semibold text-white">Veri Paylaşımı</h2>
        <p className="leading-7 text-slate-300">
          Veriler, yalnızca hizmetin ifası için gerekli tedarikçilerle sınırlı ve ölçülü şekilde paylaşılır. Kanunen
          yetkili kurum talepleri dışında üçüncü taraflarla izinsiz aktarım yapılmaz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-indigo-500 pl-4 text-2xl font-semibold text-white">Çerezler</h2>
        <p className="leading-7 text-slate-300">
          Oturum güvenliği, tercih yönetimi ve performans analizi için gerekli çerezler kullanılır. Zorunlu olmayan
          çerezler, yürürlükteki mevzuata uygun şekilde kullanıcı tercihine göre etkinleştirilir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-indigo-500 pl-4 text-2xl font-semibold text-white">Haklarınız</h2>
        <p className="leading-7 text-slate-300">
          Uygulanabilir mevzuat kapsamında verilerinize erişme, düzeltme, silme, işleme kısıtlama ve itiraz etme
          haklarına sahipsiniz. Talepler kimlik doğrulaması sonrası makul süre içinde sonuçlandırılır.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="border-l-2 border-indigo-500 pl-4 text-2xl font-semibold text-white">İletişim</h2>
        <p className="leading-7 text-slate-300">
          Gizlilik talepleri için{" "}
          <a href="mailto:assetly@gmail.com" className="text-indigo-300 underline underline-offset-2">
            assetly@gmail.com
          </a>{" "}
          adresine, genel destek konuları için{" "}
          <a href="mailto:assetly@gmail.com" className="text-indigo-300 underline underline-offset-2">
            assetly@gmail.com
          </a>{" "}
          adresine yazabilirsiniz.
        </p>
      </section>
    </article>
  );
}
