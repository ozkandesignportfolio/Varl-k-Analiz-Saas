import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Hakkımızda | Assetly",
  description:
    "Assetly'in varlık takibi, abonelik ve gider yönetimi, belge saklama ve bakım planlaması yaklaşımını tanıtan kurumsal sayfa.",
};

export default function AboutPage() {
  return (
    <main className="relative min-h-screen px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        {/* ── Site header ── */}
        <nav className="mb-6 flex items-center justify-between rounded-2xl border border-border/40 bg-card/60 px-5 py-4 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">ASSETLY</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
        </nav>

        <article className="premium-panel px-6 py-10 sm:px-10">
          <header className="border-b border-border/60 pb-8">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly</p>
            <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Hakkımızda</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              Assetly; varlık takibi, abonelik ve gider yönetimi, belge saklama ve bakım planlamasını tek bir
              yapıda birleştirerek bireysel kullanıcıların ve ekiplerin operasyonel görünürlüğünü artırmayı
              amaçlar.
            </p>
          </header>

          <div className="mt-10 space-y-10 text-[0.98rem] leading-8 text-slate-200">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">1) Assetly Nedir?</h2>
              <p className="text-muted-foreground">
                Assetly, fiziksel ve dijital varlıkların yaşam döngüsünü takip etmek, abonelikleri ve giderleri
                yönetmek, belgeleri düzenlemek ve bakım süreçlerini planlamak için tasarlanmış web tabanlı bir
                platformdur. Varlık kayıtları, maliyet takibi, belge saklama ve servis geçmişi tek panelden
                yönetilir. Amaç, farklı araçlara dağılmış bilgilerin neden olduğu gecikme, unutma ve kontrol kaybını
                azaltmaktır.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">2) Misyon ve Vizyon</h2>
              <p className="text-muted-foreground">
                Misyonumuz; kullanıcıların varlıkları, abonelikleri, giderleri ve bakım süreçleri üzerinde
                kontrolü elinde tutmasını sağlamak, kritik tarihleri kaçırma riskini düşürmek ve operasyonel
                görünürlüğü denetlenebilir bir standarda taşımaktır. Vizyonumuz; bireysel kullanıcılardan
                kurumsal ekiplere kadar geniş bir ölçekte varlık ve maliyet operasyonlarını daha düzenli,
                öngörülebilir ve sürdürülebilir hale getiren güvenilir bir referans platform olmaktır.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">3) Hangi Sorunları Çözüyoruz?</h2>
              <p className="text-muted-foreground">
                Bireysel kullanıcılarda en sık görülen sorun, garanti bitişlerinin, abonelik yenilemelerinin ve
                periyodik bakımların manuel takibi nedeniyle kritik tarihlerin unutulmasıdır. Küçük işletmelerde
                varlık kayıtları, gider belgeleri ve bakım planları farklı araçlarda tutulduğu için operasyonun
                bütün resmi kaybolur. Ekiplerde ise ortak bir veri standardı eksikliği, maliyetlerin görünürlüğünü
                ve denetimi zorlaştırır.
              </p>
              <p className="text-muted-foreground">
                Assetly bu tabloyu; varlık envanteri, abonelik ve gider takibi, belge kasası, bakım planı ve
                risk uyarılarıyla tek bir yapıda birleştirir. Böylece unutulan yenileme, atlanan servis, kaybolan
                belge ve kontrolüsüz maliyet gibi operasyonel riskler erken görünür hale gelir.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">4) Alternatiflerden Farkımız</h2>
              <p className="text-muted-foreground">
                Excel, Notion veya klasör tabanlı takip yaklaşımları esnek görünse de zamanla veri bütünlüğü, yetki
                yönetimi ve hatırlatma otomasyonu açısından sürdürülebilirliğini kaybeder. Assetly, bu dağınık yapıya
                karşı standartlaştırılmış bir kayıt akışı sunar: varlık envanteri, abonelik ve gider takibi,
                belge kasası, bakım planlaması, otomatik hatırlatmalar ve operasyon metrikleri.
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
                Küçük işletme sahipleri için Assetly, varlıkları, abonelikleri ve giderleri tek yerde tutarak
                operasyonel düzeni sağlar. Operasyon sorumluları için varlık bazlı geçmiş, maliyet eğilimi ve risk
                görünümü karar desteği sunar. Bireysel kullanıcılar için garanti takibi, abonelik hatırlatmaları,
                belge saklama ve bildirimler günlük pratik değer üretir. Ekiplerde ise varlık, belge ve bakım
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

          <div className="mt-12 border-t border-border/60 pt-8 text-center">
            <h3 className="text-xl font-semibold text-foreground">Hemen başlayın</h3>
            <p className="mt-2 text-sm text-muted-foreground">Varlıklarınızı ve giderlerinizi düzene koyun.</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Hesap Oluştur
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/30 px-6 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground"
              >
                İletişim
              </Link>
            </div>
          </div>
        </article>

        {/* ── Mini footer ── */}
        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-6 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Gizlilik Politikası</Link>
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">Kullanım Şartları</Link>
          <Link href="/legal/kvkk" className="hover:text-foreground transition-colors">KVKK</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">İletişim</Link>
          <span>2026 Assetly</span>
        </footer>
      </div>
    </main>
  );
}
