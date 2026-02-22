"use client";

import { ReactNode } from "react";

type Scenario = {
  title: string;
  story: string;
  mockup: ReactNode;
};

const scenarios: Scenario[] = [
  {
    title: "Klima servisi zamanı geldi",
    story: "Klimanızın yıllık bakım tarihi yaklaşıyor. AssetCare 7 gün önceden bildirim gönderir.",
    mockup: (
      <div className="rounded-2xl border border-white/15 bg-[#0B132A] p-4 shadow-[0_18px_45px_rgba(7,13,26,0.45)]">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Push Bildirim</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">AssetCare</p>
              <p className="mt-1 text-xs text-slate-300">Salon Kliması bakım tarihi 7 gün sonra doluyor.</p>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              Kritik
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
            Hatırlatma kuralı: Yıllık bakım
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Buzdolabı arızalandı, garanti var mı?",
    story: "Servis çağırmadan önce garanti durumunu anında görün, belgeleriniz hazır.",
    mockup: (
      <div className="rounded-2xl border border-white/15 bg-[#0B132A] p-4 shadow-[0_18px_45px_rgba(7,13,26,0.45)]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Arçelik 570560 EI</p>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            Garanti Aktif
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-300">Garanti bitiş: 18.11.2027</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Belge Listesi</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-200">
            <li className="flex items-center justify-between">
              <span>• Fatura.pdf</span>
              <span className="text-slate-400">1.2 MB</span>
            </li>
            <li className="flex items-center justify-between">
              <span>• GarantiBelgesi.jpg</span>
              <span className="text-slate-400">840 KB</span>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "Yıllık bakım maliyetim ne kadar?",
    story: "Tek tıkla PDF rapor alın, sigorta veya muhasebe için hazır belge.",
    mockup: (
      <div className="rounded-2xl border border-white/15 bg-[#0B132A] p-4 shadow-[0_18px_45px_rgba(7,13,26,0.45)]">
        <div className="rounded-lg border border-slate-300/20 bg-white p-3 text-slate-900">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold">AssetCare Raporu</span>
            <span>2026</span>
          </div>
          <p className="mt-2 text-sm font-semibold">Toplam servis maliyeti: 3.200₺</p>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-full w-[72%] rounded-full bg-indigo-500" />
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-full w-[48%] rounded-full bg-cyan-500" />
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-full w-[64%] rounded-full bg-fuchsia-500" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export default function RealUseCasesSection() {
  return (
    <section id="gerçek-senaryolar" className="premium-panel motion-fade-up motion-delay-2 p-6 sm:p-7">
      <h2 className="text-2xl font-semibold text-white">Gerçek Senaryolar</h2>
      <div className="mt-5 space-y-4">
        {scenarios.map((scenario, index) => (
          <article
            key={scenario.title}
            className={`premium-card overflow-hidden p-5 ${index % 2 === 1 ? "lg:[&>div]:grid-flow-col-dense" : ""}`}
          >
            <div className="grid items-center gap-5 lg:grid-cols-2">
              <div className={index % 2 === 1 ? "lg:col-start-2" : ""}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Senaryo {index + 1}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">{scenario.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{scenario.story}</p>
              </div>
              <div className={`scenario-mockup ${index % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}`}>
                {scenario.mockup}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

