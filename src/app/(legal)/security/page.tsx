import type { Metadata } from "next";

const securityControls = [
  {
    icon: "🔒",
    title: "Supabase RLS",
    description: "Her kullanıcı yalnızca kendi verisini görür",
  },
  {
    icon: "🗄️",
    title: "Private Storage",
    description: "Belgeleriniz şifreli, özel bucket'ta",
  },
  {
    icon: "🔑",
    title: "HTTPS Zorunlu",
    description: "Tüm trafik TLS ile korunur",
  },
  {
    icon: "📧",
    title: "Email Doğrulama",
    description: "Hesap oluşturmada doğrulama",
  },
  {
    icon: "🛡️",
    title: "Server-Side Validation",
    description: "Kritik işlemler sunucuda doğrulanır",
  },
  {
    icon: "🚫",
    title: "SQL Injection Koruması",
    description: "Parametreli sorgular, ORM",
  },
];

export const metadata: Metadata = {
  title: "Güvenlik | AssetCare",
  description: "AssetCare platformunda veri güvenliğini sağlayan teknik ve idari kontroller.",
};

export default function SecurityPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-4 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AssetCare Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Güvenlik</h1>
        <p className="text-sm leading-7 text-slate-300">
          AssetCare, kullanıcı verilerini korumak için çok katmanlı güvenlik yaklaşımı uygular. Aşağıdaki kontroller,
          hizmetin temel güvenlik omurgasını oluşturur.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {securityControls.map((control) => (
          <article key={control.title} className="premium-card hover-lift p-5">
            <p className="text-2xl leading-none">{control.icon}</p>
            <h2 className="mt-4 text-lg font-semibold text-white">{control.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{control.description}</p>
          </article>
        ))}
      </section>
    </article>
  );
}
