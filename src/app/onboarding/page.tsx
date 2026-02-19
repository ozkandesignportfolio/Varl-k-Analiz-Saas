import Link from "next/link";

export default function Onboarding() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-20 space-y-8">
      <h1 className="text-3xl font-semibold">3 Adımda Kurulum</h1>

      <Step n="1" t="İlk varlığını ekle" d="Kombi, klima, cihaz fark etmez" />
      <Step n="2" t="Garanti & bakım tarihi gir" d="Sistem riski hesaplasın" />
      <Step n="3" t="Belge yükle" d="Kanıt zinciri oluşsun" />

      <Link
        href="/assets/new"
        className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold"
      >
        İlk Varlığı Ekle
      </Link>
    </main>
  );
}

function Step({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="border border-border/60 rounded-2xl p-6">
      <div className="text-xs text-muted-foreground">Adım {n}</div>
      <div className="font-semibold mt-1">{t}</div>
      <div className="text-sm text-muted-foreground mt-2">{d}</div>
    </div>
  );
}
