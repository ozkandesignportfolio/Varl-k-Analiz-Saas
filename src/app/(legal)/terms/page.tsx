import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Şartları | AssetCare",
  description: "AssetCare hizmetinin kullanımına ilişkin şartlar ve taraf yükümlülükleri.",
};

export default function TermsPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AssetCare Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Kullanım Şartları</h1>
        <p className="text-sm leading-7 text-slate-300">
          Bu metin, AssetCare platformuna erişim ve kullanım koşullarını düzenler. Hesap oluşturan veya hizmeti
          kullanan kullanıcılar aşağıdaki şartları kabul etmiş sayılır.
        </p>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Son güncelleme: 18 Şubat 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Hizmet Tanımı</h2>
        <p className="leading-7 text-slate-300">
          AssetCare; varlık envanteri, bakım planlama, servis geçmişi, belge yönetimi, abonelik ve fatura süreçlerinin
          tek panelden yönetilmesini sağlayan bulut tabanlı bir yazılım hizmetidir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Kullanıcı Yükümlülükleri</h2>
        <p className="leading-7 text-slate-300">
          Kullanıcı, hesap bilgilerinin doğruluğundan, kimlik bilgilerinin korunmasından ve platforma yüklediği
          içeriklerin hukuka uygunluğundan sorumludur. Yetkisiz erişim şüphesi halinde derhal destek ekibine bildirim
          yapılmalıdır.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Ödeme</h2>
        <p className="leading-7 text-slate-300">
          Ücretli planlar aylık periyotla faturalandırılır. Ödeme döneminin başlangıcında tahsilat yapılır ve dijital
          fatura oluşturulur. Ödeme başarısızlığı durumunda erişim kısıtlaması uygulanabilir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">İptal</h2>
        <p className="leading-7 text-slate-300">
          Kullanıcı, yetkili hesap sahibi üzerinden abonelik iptal talebinde bulunabilir. İptal, mevcut faturalama
          dönemi sonunda yürürlüğe girer; aksi mevzuat gerektirmedikçe kısmi dönem iadesi uygulanmaz.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Sorumluluk Reddi</h2>
        <p className="leading-7 text-slate-300">
          AssetCare, hukuken izin verilen ölçüde; dolaylı zararlar, kâr kaybı veya iş kesintisinden sorumlu değildir.
          Hizmet sağlayıcı, makul teknik önlemleri uygular; ancak üçüncü taraf altyapı kesintileri ve kullanıcı kaynaklı
          hatalar üzerinde mutlak garanti vermez.
        </p>
      </section>
    </article>
  );
}
