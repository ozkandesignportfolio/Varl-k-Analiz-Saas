import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "İletişim | Assetly",
  description: "Assetly iletişim sayfası.",
};

export default function ContactPage() {
  return (
    <main className="relative min-h-screen px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        {/* ── Site header ── */}
        <nav className="mb-6 flex items-center justify-between rounded-2xl border border-border/40 bg-card/60 px-5 py-4 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <img src="/assetly-mark.svg" alt="" aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">ASSETLY</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana Sayfaya Dön
          </Link>
        </nav>

        <section className="premium-panel px-6 py-12 text-center sm:px-10">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Assetly</p>
          <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">İletişim</h1>
          <p className="mt-8 text-base leading-8 text-foreground sm:text-lg">
            Görüş, öneri ve şikayetlerinizi bizimle paylaşmak için{" "}
            <a
              href="mailto:assetly@gmail.com"
              className="text-lg font-semibold text-foreground underline decoration-2 underline-offset-4 sm:text-xl"
            >
              assetly@gmail.com
            </a>{" "}
            adresine e-posta gönderebilirsiniz. Tüm talepleriniz dikkatle değerlendirilir ve en kısa sürede geri dönüş
            sağlanır.
          </p>

          <div className="mt-10 border-t border-border/60 pt-8">
            <h3 className="text-xl font-semibold text-foreground">Platformu keşfedin</h3>
            <p className="mt-2 text-sm text-muted-foreground">Ücretsiz planla hemen deneyin. Kredi kartı gerekmez.</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Ücretsiz Hesap Oluştur
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/30 px-6 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary/50 hover:text-foreground"
              >
                Hakkımızda
              </Link>
            </div>
          </div>
        </section>

        {/* ── Mini footer ── */}
        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-6 text-xs text-muted-foreground">
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Gizlilik Politikası</Link>
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">Kullanım Şartları</Link>
          <Link href="/legal/kvkk" className="hover:text-foreground transition-colors">KVKK</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">Hakkımızda</Link>
          <span>2026 Assetly</span>
        </footer>
      </div>
    </main>
  );
}
