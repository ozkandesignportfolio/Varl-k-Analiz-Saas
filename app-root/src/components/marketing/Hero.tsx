import Link from "next/link";

const featureCards = [
  {
    title: "Varlık kaydı",
    desc: "QR, garanti ve kategori bilgileri tek yerde toplanır.",
  },
  {
    title: "Bakım kuralları",
    desc: "Periyot tanımlanır, sistem bir sonraki tarihi hesaplar.",
  },
  {
    title: "Servis akışı",
    desc: "Servis geçmişi, maliyet ve belgeler zaman çizelgesinde tutulur.",
  },
  {
    title: "Risk ve maliyet",
    desc: "Yaklaşan bakım ve gecikmeler için otomatik uyarılar.",
  },
] as const;

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#070b17]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(168,85,247,0.14),transparent_60%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-6 pt-28 pb-24 lg:grid-cols-2">
        <div>
          <div className="mb-6 inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-300">
            Güvenli • Ölçülebilir • Operasyonel kontrol
          </div>

          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
            Varlık yönetimini
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
              veriye dönüştüren
            </span>
            <br />
            kontrol merkezi
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Bakım planları, garanti süreleri, servis kayıtları ve maliyet akışına tek panelden hakim olun.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-7 py-3 font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.03]"
            >
              Ücretsiz Başla
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 px-7 py-3 text-white transition hover:bg-white/5"
            >
              Paneli İncele
            </Link>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {featureCards.map((item, index) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition hover:border-indigo-400/40"
            >
              <div className="mb-2 text-sm text-indigo-400">0{index + 1}</div>
              <h3 className="mb-2 text-lg font-semibold text-white transition group-hover:text-indigo-300">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{item.desc}</p>
              <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
