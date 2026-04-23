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
    question: "Assetly tam olarak ne yapar?",
    answer:
      "Assetly, dijital ve fiziksel varlıklarınızı tek panel üzerinden yönetmenizi sağlayan modern bir SaaS platformudur. Gelirlerinizi, yatırımlarınızı ve varlık performansınızı gerçek zamanlı takip edebilirsiniz.",
  },
  {
    question: "Verilerim güvende mi?",
    answer:
      "Evet. Assetly, endüstri standartlarında güvenlik protokolleri kullanır. Tüm veri iletişimi şifrelenir ve hassas bilgiler korunur.",
  },
  {
    question: "Hangi cihazlardan kullanabilirim?",
    answer:
      "Assetly tamamen çoklu platform uyumludur. Bilgisayar, tablet ve mobil cihazlardan kesintisiz erişim sağlar.",
  },
  {
    question: "Kurulum gerekiyor mu?",
    answer:
      "Hayır. Assetly tamamen bulut tabanlıdır. Hesap oluşturduktan sonra anında kullanmaya başlayabilirsiniz.",
  },
  {
    question: "Ücretsiz kullanabilir miyim?",
    answer:
      "Evet. Assetly'nin temel özelliklerini ücretsiz deneyebilir, daha gelişmiş araçlar için premium planlara geçebilirsiniz.",
  },
  {
    question: "Gerçek zamanlı veri takibi nasıl çalışır?",
    answer:
      "Platform, entegre veri kaynakları ve kullanıcı girişleri üzerinden varlıklarınızı anlık olarak günceller ve analiz eder.",
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
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </p>
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
            Assetly hakkında en çok sorulan sorular ve detaylı yanıtlar
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
