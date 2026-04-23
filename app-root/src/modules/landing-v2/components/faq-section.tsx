"use client"

import { useState, useRef, useCallback, type ReactNode } from "react"
import { ChevronDown, HelpCircle } from "lucide-react"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

interface FaqItem {
  question: string
  answer: ReactNode
}

const faqItems: FaqItem[] = [
  {
    question: "Assetly tam olarak hangi problemi çözer?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Fiziksel ve dijital varlıklarınızın bakım, garanti, maliyet ve belge yönetimini tek merkezde birleştirir; &quot;bir sonraki adım neydi?&quot; sorusunu ortadan kaldırır.
        </p>
        <p>
          Çoğu işletme ve birey, ekipman bakım tarihlerini kaçırır, garanti sürelerini fark edemez, abonelik ödemelerini kontrol edemez. Sonuç: kaçırılan garanti başvuruları, gereksiz harcamalar, beklenmedik arızalar ve kaybolan belgeler. Assetly bu kaçışları önler — ne zaman aksiyon almanız gerektiğini gösterir, siz hatırlamak zorunda kalmazsınız.
        </p>
      </>
    ),
  },
  {
    question: "Assetly kimler için tasarlandı?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Bireysel kullanıcılardan, onlarca ekipmanı sahada tutan işletmelere kadar herkes için.
        </p>
        <p>Tipik kullanıcı profillerimiz:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ev ve ofis ekipmanlarını düzenli tutmak isteyen bireyler.</li>
          <li>Araç filoları, makine parkurları ve saha cihazlarını takip eden KOBİ&apos;ler.</li>
          <li>Abonelik ve lisans maliyetlerini kontrol altında tutan freelancer&apos;lar ve startup&apos;lar.</li>
        </ul>
        <p>Ortak nokta: &quot;Elimdeki şeylerin durumunu, maliyetini ve bir sonraki adımını bilmek istiyorum.&quot;</p>
      </>
    ),
  },
  {
    question: "Neden Excel tablosu veya Notion yerine Assetly kullanmalıyım?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Çünkü tablolar veri depolar; ama sizi uyarmaz, öncelik belirlemez ve aksiyon aldırmaz.
        </p>
        <p>
          Excel&apos;de bir bakım tarihi yazabilirsiniz — ama o tarih geldiğinde size kim hatırlatacak? Notion&apos;da bir garanti belgesi saklayabilirsiniz — ama süre dolmadan önce kim uyaracak?
        </p>
        <p>
          Assetly yalnızca kayıt tutmaz: bakım zamanı geldiğinde bildirim gönderir, garanti bitişini izler ve hangi varlığınızın acil dikkat gerektirdiğini skorlayarak gösterir. Tablo bir araçtır; Assetly bir işletme sistemidir.
        </p>
      </>
    ),
  },
  {
    question: "Varlık takibi pratikte nasıl çalışır?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Varlığınızı ekleyin, kritik detayları girin, gerisini Assetly yönetsin.
        </p>
        <p>
          Bir varlık kaydettiğinizde satın alma tarihi, garanti süresi, bakım periyodu ve maliyeti tanımlarsınız. Assetly bu verilerden otomatik bakım takvimi oluşturur, garanti bitiş uyarıları planlar ve varlığın genel sağlık skorunu hesaplar.
        </p>
        <p>
          Her servis kaydı, belge yüklemesi veya durum değişikliği varlığın yaşam döngüsüne eklenir. Örnek akış: klima cihazınızı eklediniz, 6 aylık bakım periyodu belirlediniz. Sistem her bakım zamanı geldiğinde sizi uyarır; siz servis kaydını girerek geçmişi güncel tutarsınız. Skor otomatik olarak yeniden hesaplanır.
        </p>
      </>
    ),
  },
  {
    question: "Hangi tür varlıkları takip edebilirim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Fiziksel veya dijital — değer taşıyan ve takip gerektiren her şey.
        </p>
        <p>
          Beyaz eşya, elektronik cihazlar, araçlar, ofis ve endüstriyel ekipmanlar. Yazılım lisansları, SaaS abonelikleri, sigorta poliçeleri, kira sözleşmeleri. Assetly&apos;nin esnek kategori yapısı sayesinde her tür varlığı özel alanlarla tanımlayabilirsiniz.
        </p>
      </>
    ),
  },
  {
    question: "Verilerim güvende mi?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Verileriniz şifreli iletişim ve veritabanı düzeyinde izolasyonla korunur; yalnızca size aittir.
        </p>
        <p>
          Tüm veri iletişimi TLS 1.3 ile şifrelenir. Her kullanıcının verileri veritabanında birbirinden izole edilmiştir. Belgeleriniz özel depolama alanında tutulur ve yalnızca sizin hesabınız üzerinden erişilebilir.
        </p>
        <p>
          Üçüncü taraflarla izniniz olmadan veri paylaşımı yapılmaz. Güvenlik mimerinin merkezinde yer alır; bu alanda hiçbir zaman gevşeme olmaz.
        </p>
      </>
    ),
  },
  {
    question: "Hatırlatmalar ve otomasyonlar nasıl çalışır?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly kritik tarihleri ve eşikleri sürekli izler; harekete geçmeniz gerektiğinde proaktif olarak uyarır.
        </p>
        <p>
          Bakım periyotları, garanti bitişleri, abonelik yenilemeleri ve belge son kullanma tarihleri otomatik takip edilir.
        </p>
        <p>
          Örnek: bir varlığa 6 aylık bakım periyodu tanımladıysanız, her döngü sonunda bildirim alırsınız. Garanti bitmeden önce uyarılırsınız. Abonelik yenilenmeden önce haberdar edilirsiniz. Amaç, kritik tarihlerin arkanızdan kaymasını önlemek ve kaçırılan fırsatların maliyetini ortadan kaldırmaktır.
        </p>
      </>
    ),
  },
  {
    question: "Varlık skor sistemi nedir ve neden önemli?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Her varlığınıza bir sağlık skoru atanır — böylece &quot;şimdi hangisine bakmalıyım?&quot; sorusuna saniyeler içinde cevap alırsınız.
        </p>
        <p>
          Skor; bakım düzeni, garanti durumu, yaş, servis geçmişi ve kullanıcı girdileri dikkate alınarak hesaplanır. Düzenli bakımlı, garantisi devam eden varlık yüksek skor alır. Bakımı gecikmiş veya garantisi bitmiş varlık düşük skor alır.
        </p>
        <p>
          3 varlıkla sezgisel karar verebilirsiniz. Ancak 30 veya 300 varlık olduğunda insan hafızası ve hisleri yanıltır. Skor sistemi, karar verme sürecinizi bir veri motoruna dönüştürür; önceliği belirsizlikten çıkarır, aksiyona çevirir.
        </p>
      </>
    ),
  },
  {
    question: "Abonelik ve faturaları varlıklarla birlikte yönetebilir miyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Fiziksel varlıklar kadar dijital abonelikleri ve tekrarlayan giderleri de tek panelde izleyebilirsiniz.
        </p>
        <p>
          Yazılım lisansları, SaaS abonelikleri, sigorta poliçeleri ve periyodik bakım sözleşmeleri gibi tekrarlayan maliyetleri varlık olarak tanımlayabilirsiniz.
        </p>
        <p>
          Maliyetleri izler, yenileme tarihlerini otomatik takip edersiniz. Fatura ve belgeleri ilgili varlığa ekleyerek &quot;bu varlığa toplam ne harcadım?&quot; sorusuna tek tıkla ulaşırsınız.
        </p>
      </>
    ),
  },
  {
    question: "Bir şeyi güncellemeyi unutursam ne olur?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly eksikliği tespit eder ve sizi uyarır — unutmak, sistemin çözmeyi hedeflediği temel sorunlardan biridir.
        </p>
        <p>
          Bakım kaydını girmediyseniz, planlanan tarih geçtiğinde sistem sizi bilgilendirir ve ilgili varlığın skoru otomatik olarak düşer.
        </p>
        <p>
          Garanti belgesini yüklemediyseniz eksik belge uyarısı alırsınız. Assetly pasif bir kayıt defteri değildir. Veri eksikliğini ve gecikmeyi tespit ederek dikkatinizi çeker. Hatırlamak zorunda kalmadan kontrolü elinizde tutmanızı sağlar.
        </p>
      </>
    ),
  },
  {
    question: "Premium plana neden geçmeliyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Ücretsiz plan, Assetly&apos;yi tanımak içindir. Premium, maliyetli kaçırılan fırsatları ve gereksiz harcamaları önleyerek kendini amorti eder.
        </p>
        <p>
          Ücretsiz planda temel varlık takibi yapabilirsiniz. Ancak sınırsız varlık, gelişmiş bildirimler, detaylı raporlama, belge kasası, skor analizi ve öncelikli destek Premium&apos;a özeldir.
        </p>
        <p>
          3&apos;ten fazla varlığınız varsa, bakım takvimlerini otomatik yönetmek istiyorsanız veya belgelerinizi merkezi ve güvenli bir kasada tutmak istiyorsanız Premium, idare etme maliyetinden çok daha düşük bir yatırımdır. Kaçırılan bir bakım veya fark edilmeyen bir garanti bitişi, genellikle yıllık ücretin çok üzerinde maliyete yol açar.
        </p>
      </>
    ),
  },
  {
    question: "Kurulum gerekiyor mu? Ne kadar sürede başlarım?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Kurulum gerekmez. Hesap oluşturun, ilk varlığınızı ekleyin; iki dakika içinde aktif durumdasınız.
        </p>
        <p>
          Assetly tamamen bulut tabanlıdır. Yazılım indirmenize, sunucu kurmanıza veya teknik yapılandırma yapmanıza gerek yoktur. Kayıt olduktan sonra ilk varlığınızı hemen ekleyebilir, bakım periyodu tanımlayabilir ve belge yükleyebilirsiniz. Platform sizi adım adım yönlendirir.
        </p>
      </>
    ),
  },
  {
    question: "Buna gerçekten ihtiyacım var mı?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Eğer sahip olduğunuz herhangi bir şeyin bakım tarihini, garanti süresini veya maliyetini kafanızda tutmaya çalışıyorsanız — muhtemelen evet.
        </p>
        <p>
          &quot;Şimdilik idare ediyorum&quot; demek, genellikle sorun büyüyene kadar işe yarar.
        </p>
        <p>
          Klima garantisi fark edilmeden biter. Araç bakımı 3 ay gecikir, aşınma artar. Unutulan bir abonelik aylarca para çekmeye devam eder. Bir garanti belgesi kaybolur ve değiştirme maliyeti sizden çıkar.
        </p>
        <p>
          Assetly, bu gizli stresi ve potansiyel kayıpları ortadan kaldırır. Tek bir varlığınız bile olsa, onun durumunu ve maliyetini net görmek, &quot;her şey yolunda&quot; hissini somut veriye dönüştürür.
        </p>
      </>
    ),
  },
  {
    question: "Mobil cihazdan kullanabilir miyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Assetly, telefon ve tablet dahil tüm cihazlarda tam işlevsel olarak tasarlanmıştır.
        </p>
        <p>
          Sahada ekipman bakım kaydı girmek, garanti belgesini fotoğraflamak veya anlık durum kontrolü yapmak için mobil tarayıcınızdan tüm işlemleri gerçekleştirebilirsiniz. Arayüz, küçük ekranlarda hızlı ve konforlu kullanım için optimize edilmiştir.
        </p>
      </>
    ),
  },
]

function AccordionItem({
  item,
  isOpen,
  onToggle,
  index,
  inView,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
  index: number
  inView: boolean
}) {
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div
      className={`glass-card overflow-hidden rounded-2xl transition-all duration-500 ${
        inView ? "animate-slide-up" : "opacity-0"
      } ${isOpen ? "ring-1 ring-primary/20" : ""}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-white/[0.02] sm:px-6 sm:py-6"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-foreground sm:text-base">
          {item.question}
        </span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
            isOpen
              ? "bg-primary/15 text-primary rotate-180"
              : "bg-secondary/50 text-muted-foreground rotate-0"
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      <div
        ref={contentRef}
        className="transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen
            ? `${contentRef.current?.scrollHeight ?? 200}px`
            : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent mb-4" />
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </div>
        </div>
      </div>
    </div>
  )
}

export function FaqSection() {
  const { ref, inView } = useInView(0.05)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }, [])

  return (
    <section id="faq" className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Decorative gradient blobs */}
      <div
        className="pointer-events-none absolute left-1/4 top-1/3 z-0 hidden h-72 w-72 rounded-full bg-primary/5 blur-[120px] sm:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-1/4 bottom-1/4 z-0 hidden h-64 w-64 rounded-full bg-accent/5 blur-[100px] sm:block"
        aria-hidden
      />

      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className={`mb-12 text-center sm:mb-16 ${inView ? "animate-slide-up" : "opacity-0"}`}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs tracking-widest text-primary">SSS</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Merak <span className="text-gradient">Ettikleriniz</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Karar vermeden önce bilmeniz gereken her şey — açık, net ve doğrudan.
          </p>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-3">
          {faqItems.map((item, i) => (
            <AccordionItem
              key={i}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => handleToggle(i)}
              index={i}
              inView={inView}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
