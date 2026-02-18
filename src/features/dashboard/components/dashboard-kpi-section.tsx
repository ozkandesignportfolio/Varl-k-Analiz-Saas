type DashboardKpiSectionProps = {
  assetCount: string;
  upcomingDueCount: string;
  overdueCount: string;
  upcomingWarrantyCount: string;
  thisMonthCost: string;
  highRiskCount: string;
};

export function DashboardKpiSection({
  assetCount,
  upcomingDueCount,
  overdueCount,
  upcomingWarrantyCount,
  thisMonthCost,
  highRiskCount,
}: DashboardKpiSectionProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard label="Varlık Sayısı" value={assetCount} />
      <StatCard label="Yaklaşan Bakım (7 Gün)" value={upcomingDueCount} />
      <StatCard label="Gecikmiş Bakım" value={overdueCount} />
      <StatCard label="Yaklaşan Garanti (30 Gün)" value={upcomingWarrantyCount} />
      <StatCard label="Bu Ay Servis Maliyeti" value={thisMonthCost} />
      <StatCard label="Yüksek Riskli Tahmin" value={highRiskCount} />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

