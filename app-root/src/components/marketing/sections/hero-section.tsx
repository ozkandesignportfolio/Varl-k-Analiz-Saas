import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const painPoints = [
  "Dağınık Excel tabloları",
  "Takvimde unutulan bakım notları",
  "Klasörlerde kaybolmuş faturalar",
] as const;

export default function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[90vh] min-h-[90svh] items-center justify-center overflow-hidden px-6 pb-24 pt-28 sm:pb-32 sm:pt-36">
      {/* Subtle radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(16,239,181,0.12), transparent 65%)",
        }}
      />

      <div className="mx-auto w-full max-w-3xl text-center">
        {/* Problem pills — things you're done with */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {painPoints.map((p) => (
            <span
              key={p}
              className="rounded-full border border-destructive/20 bg-destructive/5 px-3.5 py-1.5 text-xs font-medium text-destructive/70 line-through decoration-destructive/30 decoration-[1.5px]"
            >
              {p}
            </span>
          ))}
        </div>

        {/* Headline */}
        <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Tüm varlıklarınız,{" "}
          <span className="text-gradient">tek bir panelde</span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Excel{"'"}deki garanti tarihi, takvimdeki bakım notu, e-postadaki fatura —{" "}
          <strong className="text-foreground">artık tek panelde.</strong>
        </p>

        {/* CTA pair */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            asChild
            size="lg"
            className="group w-full bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90 sm:w-auto"
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
            className="group w-full border-primary/20 bg-background/40 px-8 py-6 text-base font-semibold text-foreground hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
          >
            <Link href="#panel">
              <Play className="mr-2 h-3.5 w-3.5 text-primary" />
              Nasıl Çalışır?
            </Link>
          </Button>
        </div>

        {/* Trust line — verifiable, product-based */}
        <p className="mt-6 text-sm text-muted-foreground">
          Hızlı kurulum · Kod gerektirmez · Web {"&"} mobil uyumlu
        </p>
      </div>

      {/* Bottom separator */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </section>
  );
}
