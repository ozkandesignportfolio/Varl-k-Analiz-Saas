import Link from "next/link";
import type { MaintenanceRuleView } from "@/features/maintenance/components/types";

type UpcomingOverdueListProps = {
  isLoading: boolean;
  upcomingRules: MaintenanceRuleView[];
  overdueRules: MaintenanceRuleView[];
  onEditRule: (rule: MaintenanceRuleView) => void;
};

export function UpcomingOverdueList({
  isLoading,
  upcomingRules,
  overdueRules,
  onEditRule,
}: UpcomingOverdueListProps) {
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <ListCard
        title="Yaklaşan bakımlar"
        subtitle="Önümüzdeki 7 gün"
        isLoading={isLoading}
        emptyText="Yaklaşan bakım yok"
        items={upcomingRules}
        renderMeta={(rule) => `${rule.daysToDue} gün kaldı`}
        onEditRule={onEditRule}
      />

      <ListCard
        title="Geciken bakımlar"
        subtitle="Acil işlem önerilir"
        isLoading={isLoading}
        emptyText="Geciken bakım yok"
        items={overdueRules}
        renderMeta={(rule) => {
          if (rule.daysToDue === 0) {
            return "Bugün bakım günü";
          }
          return `${Math.abs(rule.daysToDue)} gün gecikti`;
        }}
        onEditRule={onEditRule}
      />
    </section>
  );
}

function ListCard({
  title,
  subtitle,
  isLoading,
  emptyText,
  items,
  renderMeta,
  onEditRule,
}: {
  title: string;
  subtitle: string;
  isLoading: boolean;
  emptyText: string;
  items: MaintenanceRuleView[];
  renderMeta: (rule: MaintenanceRuleView) => string;
  onEditRule: (rule: MaintenanceRuleView) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4 shadow-[0_10px_22px_rgba(2,6,23,0.32)]">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      </div>

      {isLoading ? (
        <p className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-4 text-sm text-slate-300">
          Yükleniyor...
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-3 py-4 text-sm text-slate-300">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((rule) => (
            <article
              key={rule.id}
              className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{rule.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-300">{rule.assetName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTR(rule.nextDueDate)} · {renderMeta(rule)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/services?assetId=${encodeURIComponent(rule.assetId)}`}
                    className="rounded-md border border-slate-500/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
                  >
                    Servis Kaydı Ekle
                  </Link>
                  <button
                    type="button"
                    onClick={() => onEditRule(rule)}
                    className="rounded-md border border-sky-400/50 px-2.5 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-500/15"
                  >
                    Kuralı Düzenle
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

function formatDateTR(value: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}
