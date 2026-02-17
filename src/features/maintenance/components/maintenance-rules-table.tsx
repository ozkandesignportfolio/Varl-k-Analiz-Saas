import type { IntervalUnit } from "@/lib/maintenance/next-due";
import { MaintenanceToggleDialog } from "./maintenance-toggle-dialog";

export type MaintenanceRuleRow = {
  id: string;
  asset_id: string;
  title: string;
  interval_value: number;
  interval_unit: IntervalUnit;
  last_service_date: string | null;
  next_due_date: string;
  is_active: boolean;
};

type DueBadge = {
  label: string;
  className: string;
};

type MaintenanceRulesTableProps = {
  isLoading: boolean;
  rules: MaintenanceRuleRow[];
  assetNameById: Map<string, string>;
  getDueBadge: (rule: MaintenanceRuleRow) => DueBadge;
  onStartEdit: (rule: MaintenanceRuleRow) => void;
  onToggleRuleStatus: (rule: MaintenanceRuleRow) => void;
};

export function MaintenanceRulesTable({
  isLoading,
  rules,
  assetNameById,
  getDueBadge,
  onStartEdit,
  onToggleRuleStatus,
}: MaintenanceRulesTableProps) {
  return (
    <section className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Kural Listesi</h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : rules.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">Henüz bakım kuralı yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                <th className="px-3 py-2">Kural</th>
                <th className="px-3 py-2">Varlık</th>
                <th className="px-3 py-2">Periyot</th>
                <th className="px-3 py-2">Son Servis</th>
                <th className="px-3 py-2">Sonraki Bakım</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Islem</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const badge = getDueBadge(rule);
                return (
                  <tr key={rule.id} className="border-b border-white/10 text-slate-100">
                    <td className="px-3 py-3 font-medium">{rule.title}</td>
                    <td className="px-3 py-3">{assetNameById.get(rule.asset_id) ?? "-"}</td>
                    <td className="px-3 py-3">
                      {rule.interval_value} {rule.interval_unit}
                    </td>
                    <td className="px-3 py-3">{rule.last_service_date ?? "-"}</td>
                    <td className="px-3 py-3">{rule.next_due_date}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onStartEdit(rule)}
                          className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/20"
                        >
                          Düzenle
                        </button>
                        <MaintenanceToggleDialog
                          onToggle={() => onToggleRuleStatus(rule)}
                          className="rounded-full border border-white/25 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                        >
                          {rule.is_active ? "Pasif Et" : "Aktif Et"}
                        </MaintenanceToggleDialog>
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
