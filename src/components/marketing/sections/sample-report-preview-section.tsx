"use client";

export default function SampleReportPreviewSection() {
  return (
    <section id="rapor-önizleme" className="premium-panel motion-fade-up motion-delay-3 p-6 sm:p-7">
      <h2 className="text-2xl font-semibold text-white">PDF Raporunuz Böyle Görünür</h2>
      <p className="mt-2 text-sm text-slate-300">
        Varlık, servis ve maliyet verileri tek raporda düzenli şekilde bir araya gelir.
      </p>

      <div className="mt-5 rounded-2xl border border-slate-900/70 bg-white p-5 text-slate-900 shadow-[0_28px_70px_rgba(2,6,23,0.6)]">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Varlık Raporu</p>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-semibold text-white">
              AC
            </span>
            <span className="text-xs font-semibold text-slate-700">Assetly</span>
          </div>
        </div>

        <h3 className="mt-4 text-lg font-semibold">Varlık &amp; Servis Raporu — Ocak 2026</h3>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-semibold">Varlık</th>
                <th className="px-3 py-2 font-semibold">Servis Sayısı</th>
                <th className="px-3 py-2 font-semibold">Toplam Maliyet</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2">Klima</td>
                <td className="px-3 py-2">2</td>
                <td className="px-3 py-2">1.100₺</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2">Buzdolabı</td>
                <td className="px-3 py-2">1</td>
                <td className="px-3 py-2">700₺</td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2">Kombi</td>
                <td className="px-3 py-2">2</td>
                <td className="px-3 py-2">1.400₺</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Servis Dağılımı</p>
            <div className="mt-4 flex h-24 items-end gap-2">
              <div className="report-bar h-[60%] w-full rounded-t bg-indigo-500" />
              <div className="report-bar h-[38%] w-full rounded-t bg-sky-500" />
              <div className="report-bar h-[74%] w-full rounded-t bg-fuchsia-500" />
              <div className="report-bar h-[42%] w-full rounded-t bg-cyan-500" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Özet</p>
            <dl className="mt-3 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <dt>Toplam varlık</dt>
                <dd className="font-semibold">3</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Servis kaydı</dt>
                <dd className="font-semibold">5</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Toplam maliyet</dt>
                <dd className="font-semibold">3.200₺</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <a
          href="#fiyatlandirma"
          className="inline-flex rounded-full border border-indigo-300/45 bg-indigo-500/15 px-5 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
        >
          Bu raporu PDF olarak indirin
        </a>
      </div>
    </section>
  );
}

