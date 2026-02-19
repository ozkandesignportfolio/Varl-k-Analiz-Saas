"use client";

const rows = [
  {
    label: "Garanti takibi",
    reminder: "✗",
    excel: "⚠️ manuel",
    assetCare: "✓ otomatik",
  },
  {
    label: "Bakım hatırlatıcı",
    reminder: "✓ bağlamsız",
    excel: "✗",
    assetCare: "✓ kurallı",
  },
  {
    label: "Servis geçmişi",
    reminder: "✗",
    excel: "⚠️ dağınık",
    assetCare: "✓ yapılandırılmış",
  },
  {
    label: "Belge kasası",
    reminder: "✗",
    excel: "⚠️ lokal",
    assetCare: "✓ bulut, private",
  },
  {
    label: "PDF rapor",
    reminder: "✗",
    excel: "✓ manuel",
    assetCare: "✓ otomatik",
  },
  {
    label: "Risk uyarıları",
    reminder: "✗",
    excel: "✗",
    assetCare: "✓ gerçek zamanlı",
  },
];

export default function ComparisonMatrixSection() {
  return (
    <section id="neden-assetcare" className="premium-panel motion-fade-up motion-delay-2 p-6 sm:p-7">
      <h2 className="text-2xl font-semibold text-white">Neden AssetCare?</h2>
      <p className="mt-2 text-sm text-slate-300">
        Alternatif araçlar sadece hatırlatır; AssetCare aksiyon üretir ve kanıtlar.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 rounded-2xl border border-white/15">
          <thead>
            <tr className="text-left text-sm text-slate-200">
              <th className="border-b border-white/15 bg-white/[0.03] px-4 py-3 font-semibold">Özellik</th>
              <th className="border-b border-white/15 bg-white/[0.03] px-4 py-3 font-semibold">Reminder Uygulaması</th>
              <th className="border-b border-white/15 bg-white/[0.03] px-4 py-3 font-semibold">Excel/Not Defteri</th>
              <th className="matrix-accent border-b border-indigo-300/45 bg-indigo-500/10 px-4 py-3 font-semibold text-indigo-100">
                AssetCare ✓
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="text-sm text-slate-200">
                <td className="border-b border-white/10 px-4 py-3 font-medium text-white">{row.label}</td>
                <td className="border-b border-white/10 px-4 py-3">{row.reminder}</td>
                <td className="border-b border-white/10 px-4 py-3">{row.excel}</td>
                <td className="matrix-accent border-b border-indigo-300/35 bg-indigo-500/10 px-4 py-3 font-semibold text-indigo-100">
                  {row.assetCare}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
