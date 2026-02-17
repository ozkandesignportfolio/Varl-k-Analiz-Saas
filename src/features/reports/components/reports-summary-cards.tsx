type ReportsSummaryCardsProps = {
  totalAssetCount: string;
  activeAssetCount: string;
  serviceCount: string;
  documentCount: string;
  totalCost: string;
  averageCost: string;
};

export function ReportsSummaryCards({
  totalAssetCount,
  activeAssetCount,
  serviceCount,
  documentCount,
  totalCost,
  averageCost,
}: ReportsSummaryCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <SummaryCard label="Toplam VarlÄ±k" value={totalAssetCount} />
      <SummaryCard label="Aktif VarlÄ±k" value={activeAssetCount} />
      <SummaryCard label="Servis Adedi" value={serviceCount} />
      <SummaryCard label="Belge Adedi" value={documentCount} />
      <SummaryCard label="Toplam Maliyet" value={totalCost} />
      <SummaryCard label="Ortalama Servis" value={averageCost} />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}
