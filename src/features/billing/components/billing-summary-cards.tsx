type BillingSummaryCardsProps = {
  activeSubscriptionCount: number;
  monthlyEquivalentLabel: string;
  nextThirtyDaysCount: number;
  paidThisYearLabel: string;
};

export function BillingSummaryCards({
  activeSubscriptionCount,
  monthlyEquivalentLabel,
  nextThirtyDaysCount,
  paidThisYearLabel,
}: BillingSummaryCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-4">
      <SummaryCard label="Aktif Abonelik" value={String(activeSubscriptionCount)} />
      <SummaryCard label="Aylık Eşdeğer Toplam" value={monthlyEquivalentLabel} />
      <SummaryCard label="30 Gün İçinde Yenileme" value={String(nextThirtyDaysCount)} />
      <SummaryCard label="Bu Yıl Ödenen Fatura" value={paidThisYearLabel} />
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
