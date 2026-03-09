import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Çerez Politikası | Assetly",
  description: "Assetly çerez türleri, kullanım amaçları ve tercih yönetimi ilkeleri.",
};

export default function LegalCookiesPage() {
  return (
    <article className="space-y-10">
      <header className="border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly Legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Çerez Politikası</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Bu politika, Assetly hizmetinde kullanılan çerez türlerini, kullanım amaçlarını ve kullanıcı tercih
          yönetimine ilişkin temel prensipleri açıklar.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Son güncelleme: 21 Şubat 2026</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">1. Çerez Nedir?</h2>
        <p className="text-muted-foreground">
          Çerezler, ziyaret ettiğiniz internet siteleri tarafından cihazınıza kaydedilen küçük metin dosyalarıdır.
          Çerezler; oturum yönetimi, tercihlerin hatırlanması, performans ölçümü ve hizmetin güvenli işletimi için
          kullanılabilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">2. Kullandığımız Çerez Türleri</h2>
        <h3 className="text-lg font-semibold text-foreground">2.1 Zorunlu Çerezler</h3>
        <p className="text-muted-foreground">
          Kimlik doğrulama, oturum güvenliği ve temel uygulama fonksiyonları için gereklidir. Bu çerezler olmadan hizmet
          teknik olarak çalışmayabilir.
        </p>
        <h3 className="text-lg font-semibold text-foreground">2.2 Analitik Çerezler</h3>
        <p className="text-muted-foreground">
          Uygulamanın nasıl kullanıldığını toplu düzeyde anlamak, performans iyileştirmeleri yapmak ve kullanıcı
          deneyimini geliştirmek amacıyla kullanılır.
        </p>
        <h3 className="text-lg font-semibold text-foreground">2.3 Pazarlama Çerezleri</h3>
        <p className="text-muted-foreground">
          Kampanya etkinliğini ölçmek veya ilgi alanına yönelik içerik sunmak amacıyla kullanılabilir. Bu kategori, ilgili
          mevzuatın gerektirdiği ölçüde kullanıcı tercihine bağlıdır.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">3. Çerezlerin Kullanım Amaçları</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Hesap oturumunun sürdürülebilmesi ve güvenli giriş işlemleri.</li>
          <li>Arayüz tercihleri ve kullanıcı ayarlarının hatırlanması.</li>
          <li>Hata analizi, performans izleme ve kapasite planlama.</li>
          <li>Ürün geliştirme ve kullanım istatistiklerinin oluşturulması.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">4. Üçüncü Taraf Çerezleri</h2>
        <p className="text-muted-foreground">
          Assetly, barındırma, analitik veya benzeri hizmetler için üçüncü taraf araçlardan faydalanabilir. Bu tür
          araçlar kendi çerez veya benzeri teknolojilerini kullanabilir. Üçüncü tarafların veri işleme süreçleri ilgili
          sağlayıcıların politikalarına tabidir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">5. Tercih Yönetimi</h2>
        <p className="text-muted-foreground">
          Çerez tercihlerinizi tarayıcı ayarları ve uygulama içinde sunulan tercih yönetimi ekranı üzerinden
          güncelleyebilirsiniz. Tercih yönetimi paneli geliştirilmektedir; panel aktif olana kadar tarayıcı ayarları
          geçerlidir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">6. Politika Güncellemeleri</h2>
        <p className="text-muted-foreground">
          Çerez kullanımı, teknik gereksinimler veya mevzuat değişikliklerine bağlı olarak güncellenebilir. Önemli
          değişiklikler uygulama içi duyuru veya ilgili iletişim kanalları üzerinden paylaşılır.
        </p>
      </section>
    </article>
  );
}
