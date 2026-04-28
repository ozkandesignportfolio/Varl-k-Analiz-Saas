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
    question: "Assetly SaaS maliyetlerimi nasıl azaltır?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly tüm aboneliklerinizi tek yerde gösterir, kullanılmayan araçları tespit eder ve gereksiz harcamaları ortadan kaldırmanıza yardımcı olur.
        </p>
        <p>
          Çoğu ekip, farklı kartlara ve e-postalara dağılmış onlarca abonelik için ödeme yapar. Kimsenin kullanmadığı araçlar aylarca fatura kesmeye devam eder. Assetly bu görünmez maliyetleri görünür kılar — yenilemeden önce uyarır, kullanım verisini gösterir ve iptal önerir.
        </p>
      </>
    ),
  },
  {
    question: "Ekibimin tüm araçlarını takip edebilir miyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Ekibinizin hangi araçları kullandığını ve her aboneliğe kimin atandığını görebilirsiniz.
        </p>
        <p>
          Her aracın planını, kullanıcı sayısını, aylık maliyetini ve yenileme tarihini takip edin. Farklı departmanlar farklı araçlar kullansa bile toplam SaaS harcamanızı gerçek zamanlı olarak görürsünüz.
        </p>
      </>
    ),
  },
  {
    question: "Hangi aboneliklerimiz olduğunu bilmiyorsam?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly tam da bunun için var. Gizli abonelikleri ortaya çıkarmak ilk adımdır.
        </p>
        <p>
          Araçları manuel olarak ekleyebilir ve yazılım envanteriniz üzerinde adım adım tam görünürlük oluşturabilirsiniz. Sistem yenileme tarihlerini takip eder, kullanılmayan araçları tespit eder ve sizi uyarır. İlk haftada en az bir araç bulacaksınız.
        </p>
      </>
    ),
  },
  {
    question: "Küçük ekipler için faydalı mı?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Assetly özellikle SaaS harcamalarını kontrol altına almak isteyen küçük ekipler ve startup’lar için tasarlanmıştır.
        </p>
        <p>
          Küçük ekiplerde SaaS kararları genellikle merkezi bir takip olmadan tek kişi tarafından verilir. Herkes kendi aracını satın alır ve toplam maliyeti kimse bilmez. Assetly bu kaosu ortadan kaldırır ve küçük bütçelerde büyük tasarruf sağlar.
        </p>
      </>
    ),
  },
  {
    question: "Ne kadar çabuk fayda görürüm?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Çoğu ekip, kullanımın ilk birkaç günü içinde gereksiz maliyetleri tespit etmeye başlar.
        </p>
        <p>
          Aboneliklerinizi ekledikten sonra Assetly anlık bir maliyet özeti oluşturur. Yenilemeye yaklaşan araçlar, aktif kullanıcısı olmayanlar ve pahalı abonelikler hemen görünür olur. Çoğu ekip, aylık SaaS harcamasının %10–20’sinin gereksiz olduğunu keşfeder.
        </p>
      </>
    ),
  },
  {
    question: "Neden tablo yerine Assetly kullanayım?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Tablolar veri saklar ama sizi uyarmaz, tasarruf önermez veya kaçırılan yenilemeleri yakalamaz.
        </p>
        <p>
          Notion’da abonelik listesi tutabilirsiniz — ama yenileme günü kim hatırlatacak? Excel’de maliyet tablosu yapabilirsiniz — ama kullanılmayan aracı kim tespit edecek?
        </p>
        <p>
          Assetly otomatik yenileme uyarıları, kullanım tespiti ve maliyet analizi sunar. Tablo bir defterdir; Assetly bir maliyet kontrol sistemidir.
        </p>
      </>
    ),
  },
  {
    question: "Verilerim güvende mi?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Verileriniz şifreli iletişim ve veritabanı düzeyinde izolasyon ile korunur — sadece size aittir.
        </p>
        <p>
          Tüm iletişim TLS ile şifrelenir. Her ekibin verileri tamamen izole edilmiştir. İziniz olmadan üçüncü taraflarla paylaşılmaz. Güvenlik altyapımızın çekirdeğindedir.
        </p>
      </>
    ),
  },
  {
    question: "Neden Premium’a geçmeliyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Ücretsiz plan keşif içindir. Premium, gereksiz harcamaları tespit ederek ilk ay kendini amorti eder.
        </p>
        <p>
          Sınırsız SaaS aracı takibi, gelişmiş maliyet analizi, yenileme otomasyonu, PDF maliyet raporları ve öncelikli destek yalnızca Premium’a özeldir.
        </p>
        <p>
          Ekibiniz 10’dan fazla SaaS aracı kullanıyorsa, Premium ile yakaladığınız tek bir gereksiz abonelik yıllık ücretin üzerinde tasarruf sağlar.
        </p>
      </>
    ),
  },
  {
    question: "Kurulum gerekiyor mu?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Hayır. Hesap oluşturun, ilk SaaS aracınızı ekleyin — 2 dakikada hazırsınız.
        </p>
        <p>
          Assetly tamamen bulut tabanlıdır. Kurulum, entegrasyon veya teknik bilgi gerektirmez. Kayıt olduktan sonra aboneliklerinizi eklemeye başlayın, platform sizi adım adım yönlendirir.
        </p>
      </>
    ),
  },
  {
    question: "Mobilde kullanabilir miyim?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Evet. Web, iOS ve Android — tüm cihazlarda tam işlevsel.
        </p>
        <p>
          Toplantıda hızlı maliyet kontrolü, yolda abonelik ekleme veya anlık bildirimleri takip etme — tüm özelliklere mobil tarayıcınızdan erişin.
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
            Sıkça Sorulan <span className="text-gradient">Sorular</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Başlamadan önce bilmeniz gereken her şey — açık, net ve doğrudan.
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
