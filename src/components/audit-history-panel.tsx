"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Json } from "@/types/database";

type AuditEntityType = "assets" | "maintenance_rules" | "service_logs" | "documents";
type AuditAction = "insert" | "update" | "delete";

type AuditLogRow = {
  id: string;
  user_id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  changed_fields: string[];
  old_values: Json | null;
  new_values: Json | null;
  created_at: string;
};

type AuditHistoryPanelProps = {
  title?: string;
  subtitle?: string;
  entityTypes?: AuditEntityType[];
  limit?: number;
  refreshKey?: number;
  currentUserId?: string;
};

const actionLabelByType: Record<AuditAction, string> = {
  insert: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
};

const actionToneByType: Record<AuditAction, string> = {
  insert: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
  update: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  delete: "border-rose-300/35 bg-rose-300/10 text-rose-100",
};

const entityLabelByType: Record<AuditEntityType, string> = {
  assets: "Varlık",
  maintenance_rules: "Bakım Kuralı",
  service_logs: "Servis Kaydı",
  documents: "Belge",
};

const shortenId = (value: string) => {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const toObject = (value: Json | null): Record<string, Json> => {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value as Record<string, Json>;
};

const normalizeValue = (value: Json | undefined) => {
  if (value === undefined) return "-";
  if (value === null) return "null";
  if (typeof value === "string") return value || '""';
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

const truncateText = (value: string, limit = 80) =>
  value.length > limit ? `${value.slice(0, limit)}...` : value;

export function AuditHistoryPanel({
  title = "Değişim Geçmişi",
  subtitle = "Kim, ne zaman, hangi alanı değiştirdi ve eski/yeni değer neydi bilgisini görün.",
  entityTypes = [],
  limit = 12,
  refreshKey = 0,
  currentUserId,
}: AuditHistoryPanelProps) {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    entityTypes.forEach((entityType) => params.append("entityType", entityType));
    return params.toString();
  }, [entityTypes, limit]);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setFeedback("");

    const response = await fetch(`/api/audit-logs?${queryString}`, {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as
      | { logs?: AuditLogRow[]; error?: string }
      | null;

    if (!response.ok) {
      setFeedback(result?.error ?? "Audit kayıtları yüklenemedi.");
      setIsLoading(false);
      return;
    }

    setLogs(result?.logs ?? []);
    setIsLoading(false);
  }, [queryString]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchLogs();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchLogs, refreshKey]);

  return (
    <section className="premium-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Yenile
        </button>
      </div>

      {feedback ? (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
      ) : logs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">Henüz audit kaydı bulunmuyor.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {logs.map((log) => {
            const oldValues = toObject(log.old_values);
            const newValues = toObject(log.new_values);
            const fallbackFields = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));
            const fields = log.changed_fields.length > 0 ? log.changed_fields : fallbackFields;
            const visibleFields = fields.slice(0, 8);

            return (
              <article key={log.id} className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {entityLabelByType[log.entity_type]} - {actionLabelByType[log.action]}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${actionToneByType[log.action]}`}
                    >
                      {actionLabelByType[log.action]}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                      {currentUserId && log.user_id === currentUserId ? "Sen" : shortenId(log.user_id)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {fields.length === 0 ? (
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                      Alan değişimi kaydı yok
                    </span>
                  ) : (
                    visibleFields.map((field) => (
                      <span
                        key={`${log.id}-${field}`}
                        className="rounded-full border border-sky-300/35 bg-sky-300/10 px-2.5 py-1 text-xs text-sky-100"
                      >
                        {field}
                      </span>
                    ))
                  )}
                </div>

                {visibleFields.length > 0 ? (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-white/10 bg-white/5 text-slate-300">
                        <tr>
                          <th className="px-3 py-2">Alan</th>
                          <th className="px-3 py-2">Eski Değer</th>
                          <th className="px-3 py-2">Yeni Değer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFields.map((field) => (
                          <tr key={`${log.id}-${field}-row`} className="border-b border-white/10 text-slate-100">
                            <td className="px-3 py-2 font-medium">{field}</td>
                            <td className="px-3 py-2">{truncateText(normalizeValue(oldValues[field]))}</td>
                            <td className="px-3 py-2">{truncateText(normalizeValue(newValues[field]))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {fields.length > visibleFields.length ? (
                  <p className="mt-2 text-xs text-slate-400">
                    +{fields.length - visibleFields.length} alan daha mevcut.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}


