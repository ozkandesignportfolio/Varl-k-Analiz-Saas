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
          Varlıklarınızla ilgili dağınık bilgiyi tek bir kontrol merkezinde toplar; bakım, garanti, maliyet ve belge yönetimini otomatikleştirir.
        </p>
        <p>
          Çoğu kişi ve işletme, sahip olduğu ekipmanların bakım tarihlerini kaçırır, garanti sürelerini fark edemez, abonelik ödemelerini kontrol edemez. Sonuç: gereksiz harcamalar, beklenmedik arızalar ve kaybolan belgeler. Assetly bu dağınıklığı tek bir panelde çözmenize yardımcı olur — ne zaman aksiyon almanız gerektiğini gösterir, siz hatırlamak zorunda kalmazsınız.
        </p>
      </>
    ),
  },
  {
    question: "Assetly kimler için tasarlandı?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evindeki beyaz eşyayı takip etmek isteyen bireylerden, yüzlerce ekipmanı yöneten işletmelere kadar herkes için.
        </p>
        <p>
          Tipik kullanıcılarımız: kendi ev ve ofis ekipmanlarını düzenli tutmak isteyen bireyler, araç filolarını ve sahada kullanılan cihazları yöneten küçük-orta işletmeler, abonelik ve lisans giderlerini kontrol altında tutmak isteyen freelancer&apos;lar ve startup&apos;lar. Ortak nokta: &quot;Elimdeki şeylerin durumunu, maliyetini ve bir sonraki adımını bilmek istiyorum.&quot;
        </p>
      </>
    ),
  },
  {
    question: "Neden Excel tablosu veya Notion yerine Assetly kullanmalıyım?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Tablolar veri depolar ama sizi uyarmaz, analiz etmez, otomatik aksiyon almaz.
        </p>
        <p>
          Excel&apos;de bir bakım tarihini yazabilirsiniz — ama o tarih geldiğinde sizi kim uyaracak? Notion&apos;da bir garanti belgesini saklayabilirsiniz — ama süre dolmadan önce kim hatırlatacak? Assetly verinin ötesine geçer: bakım zamanı geldiğinde bildirim gönderir, garanti bitiş tarihini izler ve hangi varlığınızın dikkat gerektirdiğini gösterir. Tablo bir araçtır; Assetly bir sistemdir.
        </p>
      </>
    ),
  },
  {
    question: "Varlık takibi pratikte nasıl çalışır?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Varlığınızı ekleyin, detaylarını girin, gerisini Assetly yönetsin.
        </p>
        <p>
          Bir varlık eklediğinizde; satın alma tarihi, garanti süresi, bakım periyodu, maliyet ve ilgili belgeleri kaydedersiniz. Assetly bu verileri kullanarak otomatik bakım takvimi oluşturur, garanti bitiş uyarıları planlar ve varlığın genel sağlık skorunu hesaplar. Her servis kaydı, belge yüklemesi veya durum değişikliği varlığın yaşam döngüsüne eklenir. Örnek: klima cihazınızı eklediniz, 6 aylık bakım periyodu tanımladınız — Assetly her bakım zamanı geldiğinde sizi bilgilendirir, siz de servis kaydını girerek geçmişi güncel tutarsınız.
        </p>
      </>
    ),
  },
  {
    question: "Hangi tür varlıkları takip edebilirim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Fiziksel veya dijital, fark etmez — değer taşıyan ve takip gerektiren her şey.
        </p>
        <p>
          Beyaz eşya, elektronik cihazlar, araçlar, ofis ekipmanları, endüstriyel makineler, yazılım lisansları, dijital abonelikler, sigorta poliçeleri, kira sözleşmeleri… Assetly&apos;nin esnek yapısı, herhangi bir varlık türünü özel kategoriler ve alanlarla tanımlamanıza olanak tanır. Takip edilmesi gereken bir değer varsa, Assetly onu yönetir.
        </p>
      </>
    ),
  },
  {
    question: "Verilerim güvende mi?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Verileriniz endüstri standardı güvenlik önlemleriyle korunur ve yalnızca size aittir.
        </p>
        <p>
          Tüm veri iletişimi TLS ile şifrelenir ve her kullanıcının verileri veritabanı düzeyinde birbirinden izole edilmiştir. Belgeleriniz özel depolama alanında, yalnızca sizin erişebileceğiniz şekilde saklanır. Üçüncü taraflarla izniniz olmadan veri paylaşımı yapılmaz.
        </p>
      </>
    ),
  },
  {
    question: "Hatırlatmalar ve otomasyonlar nasıl çalışır?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly kritik tarihleri ve eşikleri izler; harekete geçmeniz gerektiğinde sizi proaktif olarak bilgilendirir.
        </p>
        <p>
          Bakım periyotları, garanti bitiş tarihleri, abonelik yenileme zamanları ve belge son kullanma tarihleri sürekli takip edilir. Bir varlığa 6 aylık bakım periyodu tanımladıysanız, her döngü sonunda bildirim alırsınız. Garanti bitmeden önce uyarılırsınız. Abonelik yenilenmeden önce haberdar edilirsiniz. Amaç, kritik tarihlerin arkanızda kalmamasıdır.
        </p>
      </>
    ),
  },
  {
    question: "Varlık skor sistemi nedir ve neden önemli?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Her varlığınıza durumunu özetleyen bir sağlık skoru atanır — böylece hangisine öncelik vermeniz gerektiğini anında görürsünüz.
        </p>
        <p>
          Skor; bakım düzeni, garanti durumu, yaş, servis geçmişi ve kullanıcı girdileri dikkate alınarak hesaplanır. Düzenli bakımı yapılan, garantisi devam eden bir varlık yüksek skor alır; bakımı gecikmiş, garantisi bitmiş bir varlık düşük skor alır. 3 varlık yönetirken gereksiz görünebilir — ama 30 veya 300 varlık yönettiğinizde &quot;ilk hangisine bakmalıyım?&quot; sorusunun cevabını saniyeler içinde verir.
        </p>
      </>
    ),
  },
  {
    question: "Abonelik ve faturaları varlıklarla birlikte yönetebilir miyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Fiziksel varlıklar kadar dijital abonelikleri ve tekrarlayan giderleri de tek panelde yönetebilirsiniz.
        </p>
        <p>
          Yazılım lisansları, SaaS abonelikleri, sigorta poliçeleri veya periyodik bakım sözleşmeleri — hepsini varlık olarak tanımlayabilir, maliyetlerini izleyebilir ve yenileme tarihlerini otomatik takip edebilirsiniz. Fatura ve belgeleri ilgili varlığa ekleyerek &quot;bu varlığa toplam ne harcadım?&quot; sorusuna tek tıkla cevap alırsınız.
        </p>
      </>
    ),
  },
  {
    question: "Bir şeyi güncellemeyi unutursam ne olur?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly sizi uyarır — unutmak, sistemin tasarlandığı problemlerden biridir.
        </p>
        <p>
          Bakım kaydını girmediniz mi? Sistem, planlanan tarihi geçtiğinde sizi bilgilendirir ve varlığın skoru otomatik olarak düşer. Garanti belgesini yüklemediniz mi? Eksik belge uyarısı görürsünüz. Assetly pasif bir kayıt defteri değildir — veri eksikliğini tespit eder ve dikkatinizi çeker. Amaç, hatırlamak zorunda kalmadan her şeyin kontrol altında olmasıdır.
        </p>
      </>
    ),
  },
  {
    question: "Premium plana neden geçmeliyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Ücretsiz plan Assetly&apos;yi tanımanız içindir. Premium, gerçek kontrolü elinize almanız için.
        </p>
        <p>
          Ücretsiz planda temel varlık takibi yapabilirsiniz. Ancak sınırsız varlık, gelişmiş bildirimler, detaylı raporlama, belge kasası, skor analizi ve öncelikli destek gibi özellikler Premium&apos;a özeldir. Eğer 3&apos;ten fazla varlığınız varsa, bakım takvimlerini otomatik yönetmek istiyorsanız veya belgelerinizi güvenli bir kasada saklamak istiyorsanız — Premium, kaçırılan bakımları ve gereksiz harcamaları önlemenize yardımcı olarak kendini kısa sürede amorti edebilir.
        </p>
      </>
    ),
  },
  {
    question: "Kurulum gerekiyor mu? Ne kadar sürede başlarım?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Kurulum gerekmez. Hesap oluşturun, ilk varlığınızı ekleyin — 2 dakikada aktif olun.
        </p>
        <p>
          Assetly tamamen bulut tabanlıdır; yazılım indirmenize, sunucu kurmanıza veya teknik konfigürasyon yapmanıza gerek yoktur. Kayıt olduktan sonra ilk varlığınızı hemen ekleyebilir, bakım periyodu tanımlayabilir ve belge yükleyebilirsiniz. Platform sizi adım adım yönlendirir.
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
          Çoğu kişi &quot;idare ediyorum&quot; der — ta ki klima garantisi fark edilmeden bitene, araç bakımı 3 ay gecikene veya unutulan bir abonelik aylarca ödemeye devam edene kadar. Assetly, &quot;her şey kontrol altında&quot; hissini gerçeğe dönüştürür. Bir tane bile varlığınız varsa ve onun bakım tarihi, garanti süresi veya maliyeti sizin için önemliyse, Assetly bu yükü hafifletebilir.
        </p>
      </>
    ),
  },
  {
    question: "Mobil cihazdan kullanabilir miyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Assetly mobil uyumlu olarak tasarlanmıştır — telefon veya tabletten tam işlevsel erişim sağlar.
        </p>
        <p>
          Sahada bir ekipmanın bakım kaydını girmek, garanti belgesini fotoğraflamak veya anlık varlık durumunu kontrol etmek istediğinizde mobil tarayıcınızdan tüm işlemleri gerçekleştirebilirsiniz. Arayüz, küçük ekranlarda da hızlı ve konforlu kullanım için optimize edilmiştir.
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
