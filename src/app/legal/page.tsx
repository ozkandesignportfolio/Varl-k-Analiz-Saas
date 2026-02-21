import type { Metadata } from "next";
import Link from "next/link";
import { legalLinks } from "@/app/legal/legal-links";

export const metadata: Metadata = {
  title: "Yasal Metinler | AssetCare",
  description: "AssetCare yasal metinler merkezi.",
};

export default function LegalIndexPage() {
  return (
    <article className="space-y-8">
      <header className="border-b border-border/60 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">AssetCare Legal</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">Yasal Metinler</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          Bu bölüm, AssetCare hizmetinin kullanımı sırasında geçerli olan temel hukuki metinleri ve veri yönetimi
          politikalarını içerir. Belgeler düzenli olarak güncellenir ve yeni sürümler yayımlandığında bu merkezde
          erişilebilir hale getirilir.
        </p>
      </header>

      <div className="grid gap-3">
        {legalLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-border/60 bg-secondary/20 p-4 transition hover:border-primary/40 hover:bg-secondary/30"
          >
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
