import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Assetly",
  description:
    "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında Assetly veri işleme faaliyetlerine ilişkin aydınlatma metni.",
};

export default function LegalKvkkPage() {
  return (
    <article className="space-y-10">
      <header className="border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly Legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">KVKK Aydınlatma Metni</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında Assetly tarafından yürütülen veri işleme
          faaliyetleri hakkında ilgili kişileri bilgilendirmek amacıyla hazırlanmıştır.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Son güncelleme: 21 Şubat 2026</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">1. Veri Sorumlusu</h2>
        <p className="text-muted-foreground">
          Kişisel verileriniz, veri sorumlusu sıfatıyla Assetly tarafından işlenmektedir. Assetly, varlık takibi,
          garanti/bakım/servis süreçleri, belge kasası ve bildirim hizmetlerini sunarken kişisel verileri hukuka uygun
          şekilde işlemeyi taahhüt eder.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">2. İşlenen Kişisel Veri Kategorileri</h2>
        <p className="text-muted-foreground">
          Kimlik ve iletişim verileri, hesap güvenlik verileri, varlık ve servis kayıtları, bakım planlama verileri,
          belge yükleme meta verileri, finansal işlem kayıtları, kullanıcı destek kayıtları ve teknik log verileri
          işlenebilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">3. Kişisel Verilerin İşlenme Amaçları</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Hesap oluşturma, kimlik doğrulama ve yetkilendirme süreçlerinin yürütülmesi.</li>
          <li>Varlık takibi, bakım planlama, servis geçmişi ve garanti yönetimi hizmetlerinin sağlanması.</li>
          <li>Belge kasası, raporlama ve bildirim süreçlerinin işletilmesi.</li>
          <li>Faturalama, ödeme takibi, finansal kayıt ve destek süreçlerinin yürütülmesi.</li>
          <li>Bilgi güvenliği denetimi, hataların analizi ve hukuki yükümlülüklerin yerine getirilmesi.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">4. Hukuki Sebepler</h2>
        <p className="text-muted-foreground">
          Kişisel verileriniz; Kanun’un 5. ve 6. maddelerinde öngörülen sözleşmenin kurulması/ifası, hukuki
          yükümlülüklerin yerine getirilmesi, bir hakkın tesisi/kullanılması/korunması, veri sorumlusunun meşru menfaati
          ve gerekli durumlarda açık rıza hukuki sebeplerine dayanılarak işlenir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">5. Kişisel Verilerin Aktarımı</h2>
        <p className="text-muted-foreground">
          Veriler, hizmetin sunumu için gerekli olan barındırma, altyapı, bildirim, e-posta ve ödeme hizmeti
          sağlayıcılarına sınırlı ve ölçülü şekilde aktarılabilir. Yetkili kamu kurum ve kuruluşlarına yapılan aktarımlar
          yalnızca mevzuat kaynaklı zorunluluk halinde gerçekleştirilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">6. Saklama Süresi</h2>
        <p className="text-muted-foreground">
          Kişisel veriler, işleme amaçlarının gerektirdiği süre boyunca saklanır. Yasal saklama zorunluluğu bulunan
          kayıtlar ilgili mevzuatta öngörülen süreler boyunca korunur. Süre sonunda veriler silinir, yok edilir veya
          anonim hale getirilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">7. İlgili Kişi Hakları</h2>
        <p className="text-muted-foreground">
          KVKK madde 11 uyarınca ilgili kişiler; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi
          talep etme, işleme amacını ve amaca uygun kullanımı öğrenme, aktarılan tarafları bilme, düzeltme isteme, silme
          veya yok etme talebinde bulunma, otomatik sistemlerle analiz sonucu aleyhe durumlara itiraz etme ve zararın
          giderilmesini talep etme haklarına sahiptir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">8. Başvuru Yöntemi</h2>
        <p className="text-muted-foreground">
          KVKK kapsamındaki taleplerinizi kimlik doğrulamaya elverişli bilgilerle birlikte aşağıdaki iletişim adresine
          iletebilirsiniz: assetly@gmail.com
        </p>
      </section>
    </article>
  );
}
