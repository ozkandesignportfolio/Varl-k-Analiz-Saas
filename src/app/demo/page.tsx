import type { Metadata } from "next";
import Link from "next/link";
import { Play, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "@/modules/landing-v2/landing-v2.module.css";

type EmbedConfig =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "selfHosted"; src: string };

const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim() ?? "";

const demoFlowSteps = [
  "Varlık ekle",
  "Garanti/bakım tarihlerini tanımla",
  "Belgeleri yükle ve güvenli sakla",
  "Masrafları takip et, skor analizini gör",
] as const;

export const metadata: Metadata = {
  title: "Assetly Demo",
  description:
    "Assetly ürün demosu: varlık takibi, bakım planı, belge kasası ve fatura/abonelik yönetimini hızlıca keşfedin.",
};

function getEmbedConfig(rawUrl: string): EmbedConfig | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id) return { kind: "youtube", src: `https://www.youtube.com/embed/${id}` };
    }

    if (host.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        return { kind: "youtube", src: rawUrl };
      }

      const id = url.searchParams.get("v");
      if (id) return { kind: "youtube", src: `https://www.youtube.com/embed/${id}` };
    }

    if (host.includes("vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean).at(-1);
      if (id) return { kind: "vimeo", src: `https://player.vimeo.com/video/${id}` };
    }

    return { kind: "selfHosted", src: rawUrl };
  } catch {
    return null;
  }
}

export default function DemoPage() {
  const embedConfig = getEmbedConfig(demoVideoUrl);

  return (
    <main className={`${styles.scope} relative min-h-screen overflow-x-hidden bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8`}>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-75">
        <div className="hero-glow" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl space-y-6">
        <header className="glass-card rounded-3xl border border-border/70 p-6 sm:p-8">
          <h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">Assetly Demo</h1>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Varlık takibi, bakım planı, belge kasası ve fatura/abonelik yönetimini 2 dakikada görün.
          </p>
        </header>

        <section className="glass-card overflow-hidden rounded-3xl border border-border/70 p-4 sm:p-6">
          <div
            className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-background/95 via-secondary/35 to-background/90 shadow-[0_24px_90px_rgba(5,10,24,0.5)]"
            style={{ aspectRatio: "16 / 9" }}
          >
            {embedConfig ? (
              embedConfig.kind === "selfHosted" ? (
                <video
                  controls
                  preload="metadata"
                  className="absolute inset-0 h-full w-full"
                  src={embedConfig.src}
                />
              ) : (
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={embedConfig.src}
                  title="Assetly Demo Videosu"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-[0_10px_32px_rgba(16,239,181,0.24)]">
                  <Play className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-foreground sm:text-xl">Demo videosu yakında</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Yayına alındığında bu alanda doğrudan oynatabileceksiniz.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="glass-card rounded-3xl border border-border/70 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Demo Akışı</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {demoFlowSteps.map((step, index) => (
              <article key={step} className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{`Adım ${index + 1}`}</p>
                <p className="mt-2 inline-flex items-start gap-2 text-sm text-foreground sm:text-base">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{step}</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-3xl border border-border/70 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <Button asChild size="lg" className="group px-7 py-6 text-base">
              <Link href="/register">
                Ücretsiz Hesap Oluştur
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border/80 px-7 py-6 text-base">
              <Link href="/#fiyatlandirma">Fiyatlandırmayı Gör</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
