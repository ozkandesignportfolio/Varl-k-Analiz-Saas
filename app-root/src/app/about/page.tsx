import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hakkımızda | Assetly",
  description:
    "Assetly’in varlık takibi, garanti/bakım/servis süreçleri ve belge yönetimi yaklaşımını tanıtan kurumsal sayfa.",
};

export default function AboutPage() {
  return (
    <main className="relative min-h-screen px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <article className="premium-panel px-6 py-10 sm:px-10">
          <header className="border-b border-border/60 pb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly</p>
            <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Hakkımızda</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              Assetly; varlık takibi, garanti-bakım-servis süreçleri, belge kasası ve bildirim yönetimini tek bir
              SaaS panelinde birleştirerek ekiplerin ve bireysel kullanıcıların operasyonel görünürlüğünü artırmayı
              amaçlar.
            </p>
          </header>

          <div className="mt-10 space-y-10 text-[0.98rem] leading-8 text-slate-200">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">1) Assetly Nedir?</h2>
              <p className="text-muted-foreground">
                Assetly, fiziksel varlıkların yaşam döngüsünü uçtan uca takip etmek için tasarlanmış web tabanlı bir
                platformdur. Varlık kayıtlarının oluşturulması, bakım takviminin planlanması, servis geçmişinin
                belgelenmesi, garanti sürelerinin izlenmesi ve operasyonel maliyetlerin görünür hale getirilmesi tek
                panelden yönetilir. Amaç, dağınık dosya ve uygulama kullanımından kaynaklanan gecikme, unutma ve bilgi
                kaybı risklerini azaltmaktır.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">2) Misyon ve Vizyon</h2>
              <p className="text-muted-foreground">
                Misyonumuz; kullanıcıların bakım, garanti ve servis süreçlerinde kararlarını veriyle desteklemesini
                sağlamak, kritik tarihleri kaçırma riskini düşürmek ve belge yönetimini denetlenebilir bir standarda
                taşımaktır. Vizyonumuz; ev kullanıcılarından kurumsal ekiplere kadar geniş bir ölçekte varlık
                operasyonlarını daha öngörülebilir, ölçülebilir ve sürdürülebilir hale getiren güvenilir bir referans
                platform olmaktır.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">3) Hangi Sorunları Çözüyoruz?</h2>
              <p className="text-muted-foreground">
                Ev kullanıcılarında en sık görülen problem, garanti bitişlerinin ve periyodik bakımların manuel takibi
                nedeniyle kritik tarihlerin unutulmasıdır. Küçük işletmelerde servis kayıtları, satın alma belgeleri ve
                bakım planları farklı araçlarda tutulduğu için operasyonun bütün resmi kaybolur. Kurumsal yapılarda ise
                ekipler arası veri standardı eksikliği, denetim ve raporlama süreçlerini zorlaştırır.
              </p>
              <p className="text-muted-foreground">
                Assetly bu tabloyu; varlık envanteri, garanti/servis geçmişi, belge kasası, bakım planı, masraf
                görünürlüğü ve risk uyarılarıyla tek bir iş akışında birleştirir. Böylece unutulan garanti hakkı,
                atlanan servis, kaybolan fatura ve kontrolsüz maliyet gibi operasyonel riskler daha erken görünür hale
                gelir.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">4) Alternatiflerden Farkımız</h2>
              <p className="text-muted-foreground">
                Excel, Notion veya klasör tabanlı takip yaklaşımları esnek görünse de zamanla veri bütünlüğü, yetki
                yönetimi ve hatırlatma otomasyonu açısından sürdürülebilirliğini kaybeder. Assetly, bu dağınık yapıya
                karşı tek panelde standartlaştırılmış kayıt akışı sunar: otomatik hatırlatmalar, belge kasası, skor
                analizi, birleşik zaman akışı ve operasyon metrikleri.
              </p>
              <p className="text-muted-foreground">
                Platform aynı zamanda organizasyon bazlı kullanım senaryolarını, rol bazlı erişim yaklaşımını ve temel
                güvenlik kontrollerini dikkate alır. Hedefimiz, kullanıcıya aşırı vaat vermeden, gerçek operasyon
                ihtiyaçlarını karşılayan uygulanabilir bir sistem sağlamaktır.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">5) Kimler İçin?</h2>
              <p className="text-muted-foreground">
                Küçük işletme sahipleri için Assetly, bakım ve servis planlarını tek yerde tutarak işletme
                sürekliliğine katkı sağlar. Operasyon sorumluları için varlık bazlı geçmiş, masraf eğilimi ve risk
                görünümü karar desteği sunar. Ev kullanıcıları için garanti takibi, servis belgelerinin saklanması ve
                bildirimler günlük pratik değer üretir. Teknik servis takip eden ekiplerde ise iş emri, belge ve bakım
                geçmişinin birlikte görünmesi koordinasyonu iyileştirir.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">6) Güvenlik ve Veri Yaklaşımı</h2>
              <p className="text-muted-foreground">
                Assetly, çok kiracılı yapıda veri izolasyonu, kimlik doğrulama, yetkilendirme ve erişim kayıtları
                gibi temel SaaS güvenlik ilkelerini uygular. Belgeler kontrollü erişim prensibiyle saklanır; hesap
                düzeyi işlemler doğrulama mekanizmalarından geçirilir. Bununla birlikte hiçbir bulut hizmetinde mutlak
                sıfır risk iddiası gerçekçi değildir; bu nedenle süreçlerimiz sürekli iyileştirme ve izleme yaklaşımıyla
                yönetilir.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">7) Yol Haritası</h2>
              <p className="text-muted-foreground">
                Yakın dönem yol haritamızda entegrasyon kapasitesini artırmak, raporlama ekranlarını genişletmek ve
                otomasyon kurgularını senaryo bazlı hale getirmek yer alır. Bu gelişim, kullanıcı geri bildirimi ve
                operasyonel gerçeklik üzerinden önceliklendirilir. Assetly’i sürdürülebilir bir operasyon platformuna
                dönüştüren temel ilke; sade, ölçülebilir ve güvenilir ürün yaklaşımıdır.
              </p>
            </section>
          </div>

          <div className="mt-12 border-t border-border/60 pt-8">
            <Link
              href="/register"
              className="inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Ücretsiz Hesap Oluştur
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
