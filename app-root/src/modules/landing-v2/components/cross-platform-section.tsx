"use client"

import { Monitor, Smartphone, Tablet, RefreshCw } from "lucide-react"
import { useInView } from "@/modules/landing-v2/hooks/use-in-view"

const platforms = [
  { icon: Monitor, label: "Web" },
  { icon: Smartphone, label: "Mobil" },
  { icon: Tablet, label: "Tablet" },
  { icon: RefreshCw, label: "Senkron" },
] as const

export function CrossPlatformSection() {
  const { ref, inView } = useInView(0.15)

  return (
    <section
      ref={ref}
      className="relative isolate py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2
          className={`text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          Her cihazda, <span className="text-gradient">tek sistem</span>
        </h2>
        <p
          className={`mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg transition-all duration-700 delay-100 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          Verileriniz tüm cihazlarınız arasında anlık senkronize olur.
        </p>

        <div className="mt-14 flex items-center justify-center gap-10 sm:gap-16">
          {platforms.map((item, i) => (
            <div
              key={item.label}
              className={`flex flex-col items-center gap-3 transition-all duration-600 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
              style={{
                transitionDelay: inView ? `${200 + i * 120}ms` : "0ms",
              }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 sm:h-16 sm:w-16">
                <item.icon
                  aria-hidden
                  className="h-6 w-6 text-primary/80 sm:h-7 sm:w-7"
                  strokeWidth={1.6}
                />
              </div>
              <span className="text-xs font-medium tracking-wide text-muted-foreground sm:text-sm">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
