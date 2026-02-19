"use client";

const trustSignals = [
  {
    icon: "🔒",
    title: "Verileriniz Güvende",
    text: "Supabase + RLS ile izole, HTTPS zorunlu",
  },
  {
    icon: "🇹🇷",
    title: "KVKK Uyumlu",
    text: "Türk kullanıcılar için yerel standartlarda",
  },
  {
    icon: "⚡",
    title: "Anında Kurulum",
    text: "Kayıt ol, varlık ekle, 5 dakikada operasyonel",
  },
];

export default function TrustSignalsStrip() {
  return (
    <section className="premium-panel motion-fade-up motion-delay-3 p-5 sm:p-6">
      <div className="grid gap-3 md:grid-cols-3">
        {trustSignals.map((signal) => (
          <article key={signal.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xl" aria-hidden="true">
              {signal.icon}
            </p>
            <h3 className="mt-3 text-base font-semibold text-white">{signal.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{signal.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
