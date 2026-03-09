import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Assetly",
  description:
    "Assetly hizmetinde kişisel verilerin toplanması, işlenmesi, saklanması ve paylaşımına ilişkin gizlilik politikası.",
};

export default function LegalPrivacyPage() {
  return (
    <article className="space-y-10">
      <header className="border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly Legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Gizlilik Politikası</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Bu politika, Assetly platformunda gerçekleştirilen varlık takibi, garanti/bakım/servis süreçleri, belge
          kasası ve bildirim hizmetleri kapsamında kişisel verilerin nasıl işlendiğini açıklar.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Son güncelleme: 21 Şubat 2026</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">1. Kapsam</h2>
        <p className="text-muted-foreground">
          Bu metin, Assetly hizmetine web uygulaması veya ilgili dijital kanallar üzerinden erişen kullanıcıların
          kişisel verilerinin işlenmesine uygulanır. Politika, hem bireysel hesapları hem de organizasyon bazlı hesap
          kullanımını kapsar.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">2. Toplanan Veri Kategorileri</h2>
        <p className="text-muted-foreground">
          Hizmet kullanımı sırasında hesap bilgileri (ad, e-posta, rol), varlık ve bakım kayıtları, servis ve maliyet
          verileri, kullanıcı tarafından yüklenen belge meta verileri, işlem güvenliği kayıtları, bildirim tercihleri
          ve teknik loglar işlenebilir. Ödeme süreçlerinde ödeme sağlayıcısı tarafından işlenen veriler ayrıca ilgili
          sağlayıcının şartlarına tabidir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">3. Veri İşleme Amaçları</h2>
        <p className="text-muted-foreground">Kişisel veriler aşağıdaki amaçlarla işlenir:</p>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Hesap oluşturma, kimlik doğrulama ve yetkilendirme süreçlerinin yürütülmesi.</li>
          <li>Varlık takibi, bakım planlama, servis geçmişi ve garanti takibinin sağlanması.</li>
          <li>Belge kasası ve raporlama süreçlerinin işletilmesi.</li>
          <li>Bildirim, hatırlatma ve kullanıcı destek taleplerinin yönetilmesi.</li>
          <li>Hukuki yükümlülüklerin yerine getirilmesi, uyuşmazlıkların yönetimi ve hizmet güvenliğinin sağlanması.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">4. Hukuki Sebepler</h2>
        <p className="text-muted-foreground">
          Veri işleme faaliyetleri; sözleşmenin kurulması veya ifası, hukuki yükümlülüklerin yerine getirilmesi, meşru
          menfaatin korunması, bir hakkın tesisi/kullanılması/korunması ve gerekli olduğu hallerde açık rıza hukuki
          sebeplerine dayanır.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">5. Üçüncü Taraflarla Paylaşım</h2>
        <p className="text-muted-foreground">
          Veriler, hizmetin sağlanması için gerekli ölçüde barındırma, altyapı, e-posta iletimi, bildirim ve ödeme
          hizmetleri sunan iş ortaklarıyla paylaşılabilir. Kamu kurumlarına aktarım yalnızca ilgili mevzuatın zorunlu
          kıldığı durumlarda gerçekleştirilir. Assetly, gereksiz veri paylaşımı yapmama ilkesini benimser.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">6. Saklama Süreleri</h2>
        <p className="text-muted-foreground">
          Veriler, işleme amacının gerektirdiği süre boyunca ve varsa yasal saklama yükümlülükleri dikkate alınarak
          tutulur. Hesap kapatıldıktan sonra bazı kayıtlar güvenlik, muhasebe veya hukuki gereklilikler kapsamında
          sınırlı süreyle saklanabilir. Süre sonunda veriler silinir, anonimleştirilir veya erişime kapatılır.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">7. Güvenlik Tedbirleri</h2>
        <p className="text-muted-foreground">
          Assetly, rol bazlı yetkilendirme, erişim kontrolü, şifreli iletişim, loglama ve operasyonel güvenlik
          kontrolleri uygular. Bununla birlikte internet altyapısı ve üçüncü taraf servisler nedeniyle mutlak kesintisiz
          ve sıfır riskli bir ortam garanti edilmez; güvenlik süreçleri düzenli olarak gözden geçirilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">8. Kullanıcı Hakları</h2>
        <p className="text-muted-foreground">
          Kullanıcılar, uygulanabilir mevzuat kapsamında verilerine erişim, düzeltme, silme, işleme faaliyetlerine
          itiraz etme ve belirli durumlarda veri taşınabilirliği talep etme hakkına sahiptir. Talepler, kimlik doğrulama
          sonrasında makul süre içinde değerlendirilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">9. Politika Güncellemeleri</h2>
        <p className="text-muted-foreground">
          Assetly, mevzuat değişikliği, ürün güncellemeleri veya güvenlik gereksinimleri doğrultusunda bu politikayı
          güncelleyebilir. Önemli değişiklikler uygulama içi duyuru, e-posta veya hesap ekranı bilgilendirmesiyle
          kullanıcıya iletilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">10. İletişim</h2>
        <p className="text-muted-foreground">
          Gizlilik talepleri ve veri işleme süreçlerine ilişkin sorular için: assetly@gmail.com
        </p>
      </section>
    </article>
  );
}
