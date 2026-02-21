import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Şartları | AssetCare",
  description:
    "AssetCare platformunun kullanımı için geçerli olan şartlar, kullanıcı sorumlulukları ve sorumluluk sınırları.",
};

export default function LegalTermsPage() {
  return (
    <article className="space-y-10">
      <header className="border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">AssetCare Legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Kullanım Şartları</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Bu şartlar, AssetCare tarafından sunulan varlık takibi, garanti/bakım/servis süreçleri, belge kasası ve
          bildirim hizmetlerinin kullanımına ilişkin temel kuralları belirler.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Son güncelleme: 21 Şubat 2026</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">1. Hizmetin Tanımı</h2>
        <p className="text-muted-foreground">
          AssetCare, kullanıcıların sahip oldukları veya yönettikleri varlıkların bakım, garanti, servis, belge ve
          maliyet süreçlerini tek panelden yönetebilmesi için bulut tabanlı bir SaaS hizmeti sunar.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">2. Hesap ve Erişim</h2>
        <p className="text-muted-foreground">
          Kullanıcı, hesap bilgilerini doğru ve güncel tutmakla yükümlüdür. Hesaba erişim için kullanılan kimlik
          bilgileri kullanıcı sorumluluğundadır. Yetkisiz erişim şüphesi oluştuğunda kullanıcı derhal destek birimine
          bildirim yapmalıdır.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">3. Kullanıcı Sorumlulukları</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Platforma girilen veri ve yüklenen belgelerin hukuka uygunluğunu sağlamak.</li>
          <li>Üçüncü kişilerin haklarını ihlal eden içerik yüklememek.</li>
          <li>Hizmeti kötüye kullanıma, izinsiz erişime veya performans bozucu faaliyetlere konu etmemek.</li>
          <li>Abonelik ve faturalama süreçlerinde doğru bilgiler sunmak.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">4. Yasaklı Kullanım</h2>
        <p className="text-muted-foreground">
          Platformun yasa dışı faaliyet, zararlı yazılım dağıtımı, tersine mühendislik, yetkisiz veri toplama, spam,
          kimlik avı ve benzeri kötüye kullanım amaçlarıyla kullanılması yasaktır. Bu tür faaliyetler tespit edildiğinde
          hesap askıya alınabilir veya sonlandırılabilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">5. Ücretlendirme ve Faturalama</h2>
        <p className="text-muted-foreground">
          Ücretli planlar seçilen periyoda göre peşin tahsil edilir. Vergi ve benzeri yasal yükümlülükler fatura üzerinde
          gösterilir. Faturalama periyodu sonunda otomatik yenileme seçeneği aktifse sonraki dönem tahsilatı başlatılır.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">6. Fikri Mülkiyet</h2>
        <p className="text-muted-foreground">
          AssetCare markası, yazılımı, tasarımı ve ilgili içerikler üzerindeki tüm fikri mülkiyet hakları AssetCare’e
          veya lisans verenlerine aittir. Kullanıcıya yalnızca hizmetten yararlanmak için sınırlı, devredilemez kullanım
          hakkı tanınır.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">7. Askıya Alma ve Fesih</h2>
        <p className="text-muted-foreground">
          Şartlara aykırılık, güvenlik riski veya hukuki zorunluluk durumlarında AssetCare hesabı geçici olarak askıya
          alabilir ya da kalıcı olarak feshedebilir. Kullanıcı da aboneliğini hesap paneli üzerinden sonlandırabilir.
          Fesih halinde veri saklama/silme süreçleri ilgili politika kapsamında yürütülür.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">8. Sorumluluk Sınırı</h2>
        <p className="text-muted-foreground">
          AssetCare, hizmetin sürekliliği ve güvenliği için makul teknik/organizasyonel tedbirleri uygular. Ancak üçüncü
          taraf altyapı arızaları, internet kesintileri, kullanıcı hataları veya mücbir sebepler nedeniyle doğabilecek
          dolaylı zararlar için mevzuatın izin verdiği ölçüde sorumluluk kabul edilmez.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">9. Uyuşmazlıkların Çözümü</h2>
        <p className="text-muted-foreground">
          Uyuşmazlıkların öncelikle iyi niyetli müzakere yoluyla çözülmesi hedeflenir. Çözüm sağlanamaması halinde
          uygulanabilir mevzuat çerçevesinde yetkili mahkeme ve icra daireleri devreye girer.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">10. Güncelleme Bildirimleri</h2>
        <p className="text-muted-foreground">
          Bu şartlar, hizmet değişiklikleri veya hukuki gereklilikler doğrultusunda güncellenebilir. Önemli değişiklikler
          yürürlük tarihinden önce makul yöntemlerle kullanıcıya bildirilir.
        </p>
      </section>
    </article>
  );
}
