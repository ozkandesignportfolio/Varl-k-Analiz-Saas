import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hukuki Bilgilendirme | Assetly",
  description:
    "Assetly abonelik iptal/iade, hizmet seviyesi, veri saklama, güvenlik ve kabul edilebilir kullanım hükümlerinin açıklayıcı metni.",
};

export default function LegalNoticePage() {
  return (
    <article className="space-y-10">
      <header className="border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly Legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Hukuki Bilgilendirme</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Bu sayfa, Assetly hizmetinin kullanımına ilişkin tamamlayıcı hukuki konuları tek metinde açık ve anlaşılır
          şekilde sunar. Amaç; kullanıcıların abonelik süreçleri, hizmetin operasyonel sınırları, veri yaşam döngüsü,
          güvenlik yaklaşımı ve kabul edilebilir kullanım kuralları hakkında öngörülebilir bir çerçeveye sahip olmasını
          sağlamaktır.
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Son güncelleme: 21 Şubat 2026</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">İptal, Yenileme ve İade Koşulları</h2>
        <p className="text-muted-foreground">
          Ücretli planlar seçilen abonelik periyoduna göre otomatik olarak yenilenir. Kullanıcı, hesap ayarları veya
          destek kanalları üzerinden yenilemeyi durdurabilir. İptal talebinin sisteme işlendiği andan itibaren sonraki
          dönem için tahsilat yapılmaz; mevcut dönem sonuna kadar plan hakları devam eder ve dönem bitiminde hesap,
          ücretsiz seviyeye düşürülebilir veya ücretli özellik erişimi sonlandırılabilir.
        </p>
        <p className="text-muted-foreground">
          İade talepleri; yürürlükteki mevzuat, sözleşmesel hükümler, tahsilatın niteliği ve hizmet kullanım seviyesi
          birlikte değerlendirilerek sonuçlandırılır. Teknik hata nedeniyle oluşan mükerrer veya açıkça hatalı
          tahsilatlar öncelikli inceleme kapsamında ele alınır. Dönem içinde aktif olarak kullanılmış hizmetler için
          kısmi iade her durumda garanti edilmez; gerekli görülen hallerde oransal değerlendirme yapılabilir. Onaylanan
          iadelerin hesaba yansıma süresi ödeme aracına ve finansal kuruluş süreçlerine bağlı olarak değişebilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Hizmet Seviyesi, Süreklilik ve Sorumluluk Sınırları</h2>
        <p className="text-muted-foreground">
          Assetly, yüksek erişilebilirlik ve sürdürülebilir performans hedefleriyle işletilir. Bununla birlikte planlı
          bakım çalışmaları, güvenlik müdahaleleri, telekomünikasyon ve bulut altyapısı kesintileri, mücbir sebepler ve
          üçüncü taraf bağımlılıkları nedeniyle geçici aksamalar oluşabilir. Hizmet seviyesi göstergeleri operasyonel
          hedef niteliğindedir ve mutlak kesintisizlik taahhüdü olarak yorumlanmamalıdır.
        </p>
        <p className="text-muted-foreground">
          Hizmet, uygulanabilir hukuk çerçevesinde ve sözleşme hükümleri kapsamında sunulur. Dolaylı zararlar, veri kaybı
          nedeniyle doğan ikincil etkiler, gelir veya kar kaybı ile iş sürekliliği üzerindeki sonuçlara ilişkin
          sorumluluk sınırları ilgili sözleşme metinlerinde tanımlanan kapsamla sınırlıdır. Kullanıcıların kendi erişim
          yönetimi, entegrasyon tercihleri, yedekleme politikaları ve iç kontrol süreçlerinden doğan riskleri ayrıca
          yönetmesi beklenir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Veri Saklama, Arşivleme ve Silme Süreçleri</h2>
        <p className="text-muted-foreground">
          Veriler yalnızca hizmetin sunulması, hukuki yükümlülüklerin yerine getirilmesi ve meşru operasyonel amaçların
          yürütülmesi için gerekli olduğu ölçüde işlenir. Hesap verileri, işlem kayıtları, destek kayıtları, güvenlik
          logları ve mali kayıtlar; veri kategorisine, işleme amacına ve yasal saklama yükümlülüklerine göre farklı
          sürelerle tutulabilir. Saklama süresi sona eren veriler için silme, anonimleştirme veya erişime kapatma
          prosedürleri uygulanır.
        </p>
        <p className="text-muted-foreground">
          Hesap kapatma veya silme talepleri, kimlik doğrulama ve yetki kontrolleri tamamlandıktan sonra kontrollü bir
          süreçle işleme alınır. Üretim ortamından kaldırılan bazı kayıtlar, yedekleme döngüleri ve sistem bütünlüğü
          gereklilikleri nedeniyle sınırlı süreyle pasif ortamlarda tutulabilir. Bu kapsamda tutulan verilere erişim,
          yetki matrisi ve denetim kayıtlarıyla sınırlandırılır; süresi dolan kayıtlar kalıcı imha politikalarına uygun
          şekilde yok edilir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Bilgi Güvenliği ve Olay Yönetimi</h2>
        <p className="text-muted-foreground">
          Assetly, gizlilik, bütünlük ve erişilebilirlik ilkelerine dayanan çok katmanlı bir güvenlik modeli uygular.
          Bu model; kimlik doğrulama mekanizmaları, yetki ayrıştırması, şifreli veri aktarımı, oturum güvenliği,
          operasyonel izleme, değişiklik yönetimi ve denetim izi üretimi gibi teknik ve idari kontrollerden oluşur.
          Kritik sistemlerde olağandışı aktivite sinyalleri izlenir ve risk azaltma aksiyonları önceliklendirilir.
        </p>
        <p className="text-muted-foreground">
          Hiçbir dijital altyapı için mutlak güvenlik garantisi verilemeyeceği kabulüyle, olay yönetim süreçleri tespit,
          doğrulama, etki analizi, sınırlama, iyileştirme ve uygun bildirim adımlarını kapsayacak şekilde işletilir.
          Kullanıcı tarafında güçlü parola politikaları, çok faktörlü doğrulama kullanımının yaygınlaştırılması, erişim
          yetkilerinin düzenli gözden geçirilmesi ve şüpheli faaliyetlerin gecikmeksizin bildirilmesi beklenir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Kabul Edilebilir Kullanım Kuralları ve Yaptırımlar</h2>
        <p className="text-muted-foreground">
          Hizmet yalnızca hukuka, sözleşmeye ve etik ilkelere uygun iş süreçleri için kullanılmalıdır. Yetkisiz erişim
          girişimleri, güvenlik kontrollerini aşma teşebbüsleri, zararlı yazılım yayma faaliyetleri, spam üretimi,
          hizmeti bozacak otomasyonlar, fikri mülkiyet veya kişilik haklarını ihlal eden içerik yüklemeleri ve mevzuata
          aykırı kullanım türleri kesin olarak yasaktır.
        </p>
        <p className="text-muted-foreground">
          İhlal tespiti halinde, ihlalin niteliği ve etkisine göre uyarı, düzeltici aksiyon talebi, özellik kısıtlama,
          geçici askıya alma veya hesabın kalıcı olarak sonlandırılması dahil olmak üzere kademeli tedbirler
          uygulanabilir. Gerekli durumlarda, yetkili mercilerle yürürlükteki mevzuat kapsamındaki yükümlülükler doğrultusunda
          iş birliği yapılır. Bu kuralların amacı tüm kullanıcılar için güvenli, adil ve sürdürülebilir bir hizmet
          ortamı sağlamaktır.
        </p>
      </section>
    </article>
  );
}
