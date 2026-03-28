import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İletişim | Assetly",
  description: "Assetly iletişim sayfası.",
};

export default function ContactPage() {
  return (
    <main className="relative min-h-screen px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
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
        </section>
      </div>
    </main>
  );
}
