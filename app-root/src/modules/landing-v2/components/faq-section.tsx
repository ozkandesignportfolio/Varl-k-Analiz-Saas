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
    question: "How does Assetly help reduce SaaS costs?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Assetly shows all your subscriptions in one place, helping you identify unused tools and eliminate unnecessary spending.
        </p>
        <p>
          Most teams pay for dozens of subscriptions spread across different cards and emails. Tools nobody uses keep billing for months. Assetly makes these invisible costs visible — alerts you before renewals, shows usage data and recommends cancellations.
        </p>
      </>
    ),
  },
  {
    question: "Can I track all my team\u2019s tools?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Yes. You can see which tools your team uses and who is assigned to each subscription.
        </p>
        <p>
          Track the plan, user count, monthly cost and renewal date for every tool. Even if different departments use different tools, you get a real-time view of your total SaaS spend.
        </p>
      </>
    ),
  },
  {
    question: "What if I don\u2019t know all the subscriptions we have?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          That\u2019s exactly why Assetly exists. Uncovering hidden subscriptions is the first step.
        </p>
        <p>
          You can manually add tools and gradually build full visibility over your software stack. The system tracks renewal dates, detects unused tools and alerts you. Within the first week you\u2019ll find at least one tool you didn\u2019t know you were paying for.
        </p>
      </>
    ),
  },
  {
    question: "Is this useful for small teams?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Yes. Assetly is designed specifically for small teams and startups that need control over SaaS spending.
        </p>
        <p>
          In small teams, SaaS decisions are usually made by one person with no centralized tracking. Everyone buys their own tools and nobody knows the total cost. Assetly eliminates that chaos and delivers big savings on small budgets.
        </p>
      </>
    ),
  },
  {
    question: "How quickly can I see value?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Most teams start identifying unnecessary costs within the first few days of use.
        </p>
        <p>
          After adding your subscriptions, Assetly generates an instant cost summary. Tools approaching renewal, those with no active users and overpriced subscriptions become visible immediately. Most teams find 10–20% of their monthly SaaS spend is unnecessary.
        </p>
      </>
    ),
  },
  {
    question: "Why use Assetly instead of a spreadsheet?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Spreadsheets store data but they don\u2019t alert you, suggest savings or catch missed renewals.
        </p>
        <p>
          You can keep a subscription list in Notion — but who will remind you on renewal day? You can build a cost table in Excel — but who will detect the unused tool?
        </p>
        <p>
          Assetly provides automatic renewal alerts, usage detection and cost analysis. A spreadsheet is a ledger; Assetly is a cost control system.
        </p>
      </>
    ),
  },
  {
    question: "Is my data secure?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Your data is protected with encrypted communication and database-level isolation — it belongs only to you.
        </p>
        <p>
          All communication is encrypted with TLS. Each team\u2019s data is fully isolated. No sharing with third parties without your permission. Security is at the core of our infrastructure.
        </p>
      </>
    ),
  },
  {
    question: "Why should I upgrade to Premium?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          The free plan is for discovery. Premium pays for itself in the first month by identifying unnecessary spending.
        </p>
        <p>
          Unlimited SaaS tool tracking, advanced cost analysis, renewal automation, PDF cost reports and priority support are Premium-only features.
        </p>
        <p>
          If your team uses more than 10 SaaS tools, a single unnecessary subscription you catch with Premium will save more than the annual fee.
        </p>
      </>
    ),
  },
  {
    question: "Is there any setup required?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          No. Create an account, add your first SaaS tool — you\u2019re up and running in 2 minutes.
        </p>
        <p>
          Assetly is fully cloud-based. No installation, integration or technical knowledge required. After signing up, start adding your subscriptions and the platform guides you step by step.
        </p>
      </>
    ),
  },
  {
    question: "Can I use it on mobile?",
    answer: (
      <>
        <p className="font-medium text-foreground/90">
          Yes. Web, iOS and Android — fully functional on all devices.
        </p>
        <p>
          Quick cost checks in a meeting, adding a subscription on the go or tracking real-time notifications — access all features from your mobile browser.
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
            <span className="text-xs tracking-widest text-primary">FAQ</span>
          </div>
          <h2 className="text-balance text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Everything you need to know before getting started — clear, direct and honest.
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
