import type { ReactNode } from "react";
import { ServiceDeleteDialog } from "./service-delete-dialog";

export type ServiceLogTableRow = {
  id: string;
  asset_id: string;
  rule_id: string | null;
  service_type: string;
  service_date: string;
  cost: number;
  provider: string | null;
  notes: string | null;
  created_at: string;
};

type ServiceLogTableProps = {
  isLoading: boolean;
  logs: ServiceLogTableRow[];
  assetNameById: Map<string, string>;
  ruleNameById: Map<string, string>;
  onStartEdit?: (log: ServiceLogTableRow) => void;
  onDeleteLog?: (log: ServiceLogTableRow) => void;
  emptyState?: ReactNode;
};

export function ServiceLogTable({
  isLoading,
  logs,
  assetNameById,
  ruleNameById,
  onStartEdit,
  onDeleteLog,
  emptyState,
}: ServiceLogTableProps) {
  const hasActions = Boolean(onStartEdit || onDeleteLog);

  return (
    <section className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Servis Gecmisi</h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
      ) : logs.length === 0 ? (
        emptyState ?? <p className="mt-4 text-sm text-slate-300">Henuz servis kaydi yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Varlik</th>
                <th className="px-3 py-2">Kural</th>
                <th className="px-3 py-2">Tur</th>
                <th className="px-3 py-2">Maliyet</th>
                <th className="px-3 py-2">Saglayici</th>
                {hasActions ? <th className="px-3 py-2">Islem</th> : null}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-white/10 text-slate-100">
                  <td className="px-3 py-3">{log.service_date}</td>
                  <td className="px-3 py-3">{assetNameById.get(log.asset_id) ?? "-"}</td>
                  <td className="px-3 py-3">
                    {log.rule_id ? (ruleNameById.get(log.rule_id) ?? "Bagli kural") : "-"}
                  </td>
                  <td className="px-3 py-3">{log.service_type}</td>
                  <td className="px-3 py-3">{Number(log.cost).toFixed(2)} TL</td>
                  <td className="px-3 py-3">{log.provider ?? "-"}</td>
                  {hasActions ? (
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {onStartEdit ? (
                          <button
                            type="button"
                            onClick={() => onStartEdit(log)}
                            className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/20"
                          >
                            Duzenle
                          </button>
                        ) : null}
                        {onDeleteLog ? (
                          <ServiceDeleteDialog
                            className="rounded-full border border-red-300/35 bg-red-300/10 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-300/20"
                            onConfirm={() => onDeleteLog(log)}
                          >
                            Sil
                          </ServiceDeleteDialog>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
