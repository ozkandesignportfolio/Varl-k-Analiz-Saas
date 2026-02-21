import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İletişim | AssetCare",
  description: "AssetCare iletişim sayfası.",
};

export default function ContactPage() {
  return (
    <main className="relative min-h-screen px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <section className="premium-panel px-6 py-12 text-center sm:px-10">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">AssetCare</p>
          <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">İletişim</h1>
          <p className="mt-6 text-lg text-foreground">Yakında</p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Bu sayfa kısa süre içinde güncellenecektir. Şimdilik iletişim formu bulunmamaktadır.
          </p>
        </section>
      </div>
    </main>
  );
}
