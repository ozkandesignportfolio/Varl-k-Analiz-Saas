type SummaryFilter = "total" | "upcoming" | "overdue";

type MaintenanceSummaryCardsProps = {
  totalCount: number;
  upcomingCount: number;
  overdueCount: number;
  onView: (filter: SummaryFilter) => void;
};

const numberFormatter = new Intl.NumberFormat("tr-TR");

export function MaintenanceSummaryCards({
  totalCount,
  upcomingCount,
  overdueCount,
  onView,
}: MaintenanceSummaryCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <SummaryCard
        title="Toplam Kural"
        value={numberFormatter.format(totalCount)}
        description="Tanımlı tüm bakım kurallarınız."
        onView={() => onView("total")}
      />
      <SummaryCard
        title="Yaklaşan (7 gün)"
        value={numberFormatter.format(upcomingCount)}
        description="Önümüzdeki 7 gün içinde planlananlar."
        onView={() => onView("upcoming")}
      />
      <SummaryCard
        title="Geciken"
        value={numberFormatter.format(overdueCount)}
        description="Bugün ve öncesinde kalmış bakımlar."
        onView={() => onView("overdue")}
      />
    </section>
  );
}

function SummaryCard({
  title,
  value,
  description,
  onView,
}: {
  title: string;
  value: string;
  description: string;
  onView: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4 shadow-[0_10px_22px_rgba(2,6,23,0.32)]">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-100">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
      <button
        type="button"
        onClick={onView}
        className="mt-3 text-sm font-medium text-sky-300 transition hover:text-sky-200"
      >
        Görüntüle
      </button>
    </article>
  );
}

export type { SummaryFilter };
