type ServiceSummaryCardProps = {
  hasActiveFilters: boolean;
  visibleRecordCount: number;
  visibleCostLabel: string;
  visibleAssetCount: number;
  totalRecordCount: number;
  serviceTypeDistribution: { type: string; count: number }[];
  maxDistributionCount: number;
};

export function ServiceSummaryCard({
  hasActiveFilters,
  visibleRecordCount,
  visibleCostLabel,
  visibleAssetCount,
  totalRecordCount,
  serviceTypeDistribution,
  maxDistributionCount,
}: ServiceSummaryCardProps) {
  return (
    <article className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Servis Özeti</h2>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SummaryItem label={hasActiveFilters ? "Görünen Kayıt" : "Toplam Kayıt"} value={String(visibleRecordCount)} />
        <SummaryItem label={hasActiveFilters ? "Görünen Maliyet" : "Toplam Maliyet"} value={visibleCostLabel} />
        <SummaryItem label="Varlık" value={String(visibleAssetCount)} />
      </div>
      {hasActiveFilters ? (
        <p className="mt-2 text-xs text-slate-300">Toplam kayıt: {totalRecordCount}</p>
      ) : null}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-200">Tür Dağılımı</h3>
        {serviceTypeDistribution.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">Henüz servis kaydı bulunmuyor.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {serviceTypeDistribution.map((item) => {
              const width = Math.max(8, (item.count / maxDistributionCount) * 100);
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{item.type}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </article>
  );
}
