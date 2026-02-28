import type {
  MaintenanceAssetOption,
  MaintenanceRuleView,
  RulePeriodFilter,
  RuleStatusFilter,
} from "@/features/maintenance/components/types";

type RulesTableProps = {
  isLoading: boolean;
  rules: MaintenanceRuleView[];
  assets: MaintenanceAssetOption[];
  searchTerm: string;
  assetFilter: string;
  statusFilter: RuleStatusFilter;
  periodFilter: RulePeriodFilter;
  onSearchTermChange: (value: string) => void;
  onAssetFilterChange: (value: string) => void;
  onStatusFilterChange: (value: RuleStatusFilter) => void;
  onPeriodFilterChange: (value: RulePeriodFilter) => void;
  onClearFilters: () => void;
  onEditRule: (rule: MaintenanceRuleView) => void;
  onToggleRuleStatus: (rule: MaintenanceRuleView) => void;
  onDeleteRule: (rule: MaintenanceRuleView) => void;
};

const unitLabels: Record<Exclude<RulePeriodFilter, "all">, string> = {
  day: "Gün",
  week: "Hafta",
  month: "Ay",
  year: "Yıl",
};

export function RulesTable({
  isLoading,
  rules,
  assets,
  searchTerm,
  assetFilter,
  statusFilter,
  periodFilter,
  onSearchTermChange,
  onAssetFilterChange,
  onStatusFilterChange,
  onPeriodFilterChange,
  onClearFilters,
  onEditRule,
  onToggleRuleStatus,
  onDeleteRule,
}: RulesTableProps) {
  return (
    <section
      className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4 shadow-[0_10px_22px_rgba(2,6,23,0.32)]"
      data-testid="maintenance-rules-table-section"
    >
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-slate-100">Kurallar</h3>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Kural veya varlık ara"
            className="h-10 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
          />

          <select
            value={assetFilter}
            onChange={(event) => onAssetFilterChange(event.target.value)}
            className="h-10 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
          >
            <option value="">Varlık: Tümü</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as RuleStatusFilter)}
            className="h-10 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
          >
            <option value="all">Durum: Tümü</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>

          <select
            value={periodFilter}
            onChange={(event) => onPeriodFilterChange(event.target.value as RulePeriodFilter)}
            className="h-10 rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400"
          >
            <option value="all">Periyot: Tümü</option>
            <option value="day">{unitLabels.day}</option>
            <option value="week">{unitLabels.week}</option>
            <option value="month">{unitLabels.month}</option>
            <option value="year">{unitLabels.year}</option>
          </select>

          <button
            type="button"
            onClick={onClearFilters}
            className="h-10 rounded-lg border border-slate-500/80 px-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Temizle
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 rounded-xl border border-slate-700/80 bg-slate-900/50 px-3 py-4 text-sm text-slate-300">
          Kurallar yükleniyor...
        </p>
      ) : rules.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-3 py-4 text-sm text-slate-300">
          Filtreye uygun kural bulunamadı.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700/80">
          <table className="min-w-full text-left text-sm" data-testid="maintenance-rules-table">
            <thead className="bg-slate-900/90 text-slate-300">
              <tr className="border-b border-slate-700/70">
                <th className="px-3 py-2">Varlık</th>
                <th className="px-3 py-2">Kural Adı</th>
                <th className="px-3 py-2">Periyot</th>
                <th className="px-3 py-2">Son Baz Tarih</th>
                <th className="px-3 py-2">Sonraki Bakım</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const dueBadge = resolveDueBadge(rule);
                return (
                  <tr key={rule.id} className="border-b border-slate-800/70 text-slate-100">
                    <td className="px-3 py-3">{rule.assetName}</td>
                    <td className="px-3 py-3 font-medium">{rule.title}</td>
                    <td className="px-3 py-3">{rule.intervalLabel}</td>
                    <td className="px-3 py-3">{formatDateTR(rule.lastServiceDate)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span>{formatDateTR(rule.nextDueDate)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${dueBadge.className}`}>
                          {dueBadge.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          rule.isActive
                            ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                            : "border-slate-500/70 bg-slate-700/40 text-slate-200"
                        }`}
                      >
                        {rule.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditRule(rule)}
                          className="rounded-md border border-sky-400/50 px-2.5 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-500/15"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleRuleStatus(rule)}
                          className="rounded-md border border-slate-500/70 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                          {rule.isActive ? "Durdur" : "Aktif Et"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRule(rule)}
                          className="rounded-md border border-rose-500/60 px-2.5 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
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

function resolveDueBadge(rule: MaintenanceRuleView) {
  if (!rule.isActive) {
    return {
      label: "Pasif",
      className: "border-slate-500/70 bg-slate-700/40 text-slate-200",
    };
  }

  if (rule.daysToDue <= 0) {
    return {
      label: "Gecikmiş",
      className: "border-rose-500/60 bg-rose-500/10 text-rose-200",
    };
  }

  if (rule.daysToDue <= 7) {
    return {
      label: "Yaklaşan",
      className: "border-amber-400/60 bg-amber-500/10 text-amber-200",
    };
  }

  return {
    label: "Planlı",
    className: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200",
  };
}
