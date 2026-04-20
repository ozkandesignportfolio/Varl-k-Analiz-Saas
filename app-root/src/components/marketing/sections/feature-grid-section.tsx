"use client";

import type { ComponentType } from "react";
import { Shield, Bell, CreditCard, FileText, Lock, Zap, Globe, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useInView } from "@/modules/landing-v2/hooks/use-in-view";

interface Feature {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Shield,
    title: "Birleşik varlık kaydı",
    description: "Garanti, bakım ve servis bilgileri her varlık için tek sayfada toplanır. Farklı dosyalara dağılmış kayıtları bir araya getirir.",
  },
  {
    icon: Bell,
    title: "Otomatik bakım hatırlatma",
    description: "Periyodik bakım tarihleri yaklaşınca bildirim gönderir. Takvime not düşürmek yerine, sistem sizin için takip eder.",
  },
  {
    icon: CreditCard,
    title: "Abonelik takibi",
    description: "Hangi aboneliğin ne zaman yenilendiğini tek listede görürsünüz. Her hizmeti ayrı kontrol etmek yerine, tek ekran yeterli.",
  },
  {
    icon: FileText,
    title: "Fatura yönetimi",
    description: "Ödeme kayıtlarını saklayın, durumlarını takip edin. Fatura aramak için klasör veya e-posta karıştırmanıza gerek kalmaz.",
  },
];

const trustSignals = [
  { icon: Lock, text: "RLS veri izolasyonu" },
  { icon: Zap, text: "Kurulum 2 dakika" },
  { icon: Globe, text: "Her cihazda çalışır" },
] as const;

export default function FeatureGridSection() {
  const { ref, inView } = useInView(0.1);

  return (
    <section className="relative isolate py-20 sm:py-28 lg:py-32" ref={ref}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-14 text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Neden Assetly?
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            4 ayrı araç yerine{" "}
            <span className="text-gradient">tek platform</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
            Her biri farklı bir araç gerektiren iş akışlarını
            tek panelde birleştirir.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`
                  glass-card group cursor-default rounded-2xl p-6
                  transition-all duration-500
                  ${inView ? "animate-slide-up" : "opacity-0"}
                `}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  <Icon aria-hidden className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1.5 text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Trust signal strip */}
        <div
          className={`mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 ${
            inView ? "animate-slide-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.5s" }}
        >
          {trustSignals.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.text} className="flex items-center gap-2">
                <Icon aria-hidden className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-xs font-medium text-muted-foreground">{s.text}</span>
              </div>
            );
          })}
        </div>

        {/* Final CTA */}
        <div
          className={`mt-16 text-center ${
            inView ? "animate-slide-up" : "opacity-0"
          }`}
          style={{ animationDelay: "0.6s" }}
        >
          <p className="mx-auto mb-3 max-w-md text-lg font-semibold text-foreground sm:text-xl">
            Hazırsanız, birkaç dakika yeter
          </p>
          <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
            Ücretsiz plan ile başlayın, ihtiyacınız oldukça büyütün.
          </p>
          <Button
            asChild
            size="lg"
            className="group bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:bg-primary/90"
          >
            <Link href="/register">
              Hemen Ücretsiz Başla
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
