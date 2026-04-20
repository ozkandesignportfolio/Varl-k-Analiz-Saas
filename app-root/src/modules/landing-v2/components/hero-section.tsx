import Link from "next/link"
import { ArrowRight, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"

const platforms = [
  {
    label: "Web",
    accent: "from-sky-400/25 via-sky-400/10 to-transparent",
    iconColor: "text-sky-300",
    renderIcon: (className: string) => <Monitor aria-hidden className={className} strokeWidth={1.5} />,
  },
  {
    label: "Android",
    accent: "from-emerald-400/25 via-emerald-400/10 to-transparent",
    iconColor: "text-emerald-300",
    renderIcon: (className: string) => (
      <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.523 15.341a.999.999 0 1 1 0-1.999.999.999 0 0 1 0 1.999m-11.046 0a.999.999 0 1 1 0-1.999.999.999 0 0 1 0 1.999m11.404-6.02 1.997-3.459a.416.416 0 0 0-.72-.415l-2.022 3.503C15.59 8.244 13.853 7.851 12 7.851s-3.59.393-5.137 1.099L4.841 5.447a.416.416 0 1 0-.72.415l1.998 3.459C2.689 11.187.343 14.659 0 18.761h24c-.343-4.102-2.689-7.574-6.118-9.44M8.4 5.2a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2m7.2 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2" />
      </svg>
    ),
  },
  {
    label: "iOS",
    accent: "from-slate-200/20 via-slate-200/10 to-transparent",
    iconColor: "text-slate-100",
    renderIcon: (className: string) => (
      <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.26-.89 3.58-.8 1.57.13 2.76.74 3.54 1.84-3.17 1.9-2.44 6.1 1.11 7.29-.71 1.57-1.77 3.14-3.31 4.54M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25" />
      </svg>
    ),
  },
] as const

export function HeroSection() {
  return (
    <section className="relative isolate flex min-h-screen min-h-[100svh] items-center justify-center overflow-x-hidden overflow-y-visible pb-12 pt-24 sm:pb-20 sm:pt-28">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" />

      <div aria-hidden="true" className="landing-v2-hero-motion pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="landing-v2-hero-motion-plane">
          <span className="landing-v2-hero-blob landing-v2-hero-blob-a" />
          <span className="landing-v2-hero-blob landing-v2-hero-blob-b" />
          <span className="landing-v2-hero-blob landing-v2-hero-blob-c" />
        </div>
      </div>

      <div className="pointer-events-none absolute top-1/4 left-1/4 -z-10 hidden h-96 w-96 rounded-full bg-primary/5 blur-[84px] sm:block" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 -z-10 hidden h-80 w-80 rounded-full bg-accent/5 blur-[72px] sm:block" />

      {/* Orbiting dots are decorative-only and continuously repaint; hide on
          mobile where GPU budget is tighter and visual noise competes with
          the value proposition. Keep on sm+ where desktop GPUs can afford it. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 hidden h-72 w-72 -translate-x-1/2 -translate-y-1/2 opacity-[0.15] sm:block">
        <div className="animate-orbit absolute">
          <div className="h-3 w-3 rounded-full bg-primary" />
        </div>
        <div className="animate-orbit absolute" style={{ animationDelay: "-7s" }}>
          <div className="h-2 w-2 rounded-full bg-accent" />
        </div>
        <div className="animate-orbit absolute" style={{ animationDelay: "-14s" }}>
          <div className="h-2.5 w-2.5 rounded-full bg-chart-3" />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        <div className="animate-slide-up mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2">
          <span className="relative flex h-2 w-2">
            <span className="landing-v2-ping-dot absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-sm text-primary">Yeni: Skor Analizi ve Fatura Takip</span>
        </div>

        <h1
          className="animate-slide-up text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ animationDelay: "0.1s" }}
        >
          <span className="text-balance">
            Varlıklarınızı <span className="text-gradient">akıllı</span>
            <br className="hidden sm:block" /> yönetin, riskleri <span className="text-gradient">önleyin</span>
          </span>
        </h1>

        <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl" style={{ animationDelay: "0.2s" }}>
          Bakım, garanti, servis ve belge süreçlerinizi tek panelde takip edin. Akıllı bildirimler, abonelik yönetimi
          ve skor analizi ile her zaman kontrolde kalın.
        </p>
        <div className="animate-slide-up mb-4 mt-10 flex flex-col items-center justify-center gap-3 sm:mt-12 sm:flex-row sm:gap-4" style={{ animationDelay: "0.3s" }}>
          <Button
            asChild
            size="lg"
            className="group w-full bg-primary px-8 py-6 text-base text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90 focus-visible:ring-primary/70 sm:w-auto"
          >
            <Link href="/register">
              Ücretsiz Başla
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="landing-v2-cta-secondary group w-full border-primary/25 bg-background/40 px-8 py-6 text-base text-foreground backdrop-blur-sm hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-primary/50 sm:w-auto"
          >
            <Link href="#ozellikler">
              Özellikleri keşfet
            </Link>
          </Button>
        </div>
        <p
          className="animate-slide-up mb-8 text-xs text-muted-foreground/80 sm:mb-12"
          style={{ animationDelay: "0.4s" }}
        >
          Ücretsiz plan · Kredi kartı gerekmez · 2 dakikada kurulum
        </p>

        <div className="mx-auto mt-4 flex max-w-md flex-col items-center sm:mt-6">
          <ul className="flex items-center justify-center gap-8 sm:gap-12">
            {platforms.map((platform, index) => (
              <li
                key={platform.label}
                className="flex flex-col items-center gap-2"
                style={{
                  animation: "landingV2HeroStripIn 400ms ease-out both",
                  animationDelay: `${500 + index * 120}ms`,
                }}
              >
                <span
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md sm:h-16 sm:w-16 ${platform.iconColor}`}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${platform.accent} opacity-80`}
                  />
                  <span className="relative">{platform.renderIcon("h-7 w-7 sm:h-8 sm:w-8")}</span>
                </span>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground/70 sm:text-xs">
                  {platform.label}
                </span>
              </li>
            ))}
          </ul>
          <p
            className="mt-5 text-xs text-muted-foreground/70 sm:text-sm"
            style={{
              animation: "landingV2HeroStripIn 400ms ease-out both",
              animationDelay: `${500 + platforms.length * 120}ms`,
            }}
          >
            Web, Android ve iOS ile tam uyumlu
          </p>
        </div>
      </div>

      <style>{`@keyframes landingV2HeroStripIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion: reduce){[style*="landingV2HeroStripIn"]{animation:none!important;opacity:1!important;transform:none!important}}`}</style>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </section>
  )
}
