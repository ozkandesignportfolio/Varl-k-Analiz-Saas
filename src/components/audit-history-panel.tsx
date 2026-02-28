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

const HIDDEN_FIELDS = new Set(["id", "user_id", "created_at", "updated_at", "entity_id"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fieldLabelByKey: Record<string, string> = {
  name: "Ad",
  category: "Kategori",
  serial_number: "Seri No",
  brand: "Marka",
  model: "Model",
  purchase_date: "Satın Alma Tarihi",
  warranty_end_date: "Garanti Bitiş Tarihi",
  notes: "Not",
  photo_path: "Fotoğraf",
  qr_code: "QR Kodu",
  title: "Başlık",
  interval_value: "Periyot",
  interval_unit: "Periyot Birimi",
  last_service_date: "Son Servis Tarihi",
  next_due_date: "Sonraki Bakım Tarihi",
  is_active: "Aktif",
  service_type: "Servis Türü",
  service_date: "Servis Tarihi",
  cost: "Tutar",
  provider: "Servis Sağlayıcı",
  document_type: "Belge Türü",
  file_name: "Dosya Adı",
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

const formatDateLikeText = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return value.includes("T") ? parsed.toLocaleString("tr-TR") : parsed.toLocaleDateString("tr-TR");
};

const normalizeValue = (value: Json | undefined) => {
  if (value === undefined || value === null) return "-";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "-";
    if (UUID_PATTERN.test(trimmed)) return shortenId(trimmed);
    const formattedDate = formatDateLikeText(trimmed);
    return formattedDate ?? trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

const truncateText = (value: string, limit = 80) =>
  value.length > limit ? `${value.slice(0, limit)}...` : value;

const toFieldLabel = (field: string) =>
  fieldLabelByKey[field] ?? field.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toLocaleUpperCase("tr-TR"));

const renderChangeText = (log: AuditLogRow, oldValue: string, newValue: string) => {
  if (log.action === "insert") return newValue;
  if (log.action === "delete") return oldValue;
  return `${oldValue} → ${newValue}`;
};

const summarizeLog = (log: AuditLogRow, fieldCount: number) => {
  if (fieldCount === 0) {
    if (log.action === "insert") return "Yeni kayıt eklendi.";
    if (log.action === "delete") return "Kayıt silindi.";
    return "Kayıt güncellendi.";
  }

  if (log.action === "insert") return `${fieldCount} bilgi eklendi.`;
  if (log.action === "delete") return `${fieldCount} bilgi silindi.`;
  return `${fieldCount} bilgi güncellendi.`;
};

export function AuditHistoryPanel({
  title = "Değişim Geçmişi",
  subtitle = "Son işlemleri sade bir şekilde takip edin.",
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
            const visibleFields = fields.filter((field) => !HIDDEN_FIELDS.has(field));
            const previewFields = visibleFields.slice(0, 3);

            return (
              <article key={log.id} className="rounded-xl border border-white/15 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{entityLabelByType[log.entity_type]}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </p>
                    <p className="mt-2 text-sm text-slate-200">{summarizeLog(log, visibleFields.length)}</p>
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

                {previewFields.length > 0 ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-slate-950/35 p-3">
                    {previewFields.map((field) => {
                      const oldText = truncateText(normalizeValue(oldValues[field]), 50);
                      const newText = truncateText(normalizeValue(newValues[field]), 50);
                      return (
                        <p key={`${log.id}-${field}-preview`} className="text-sm text-slate-100">
                          <span className="font-medium text-white">{toFieldLabel(field)}:</span>{" "}
                          <span className="text-slate-300">{renderChangeText(log, oldText, newText)}</span>
                        </p>
                      );
                    })}
                  </div>
                ) : null}

                {visibleFields.length > previewFields.length ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-300 hover:text-slate-100">
                      Daha fazla detay göster ({visibleFields.length - previewFields.length})
                    </summary>
                    <div className="mt-2 space-y-1 rounded-lg border border-white/10 bg-slate-950/35 p-3">
                      {visibleFields.slice(3).map((field) => {
                        const oldText = truncateText(normalizeValue(oldValues[field]), 60);
                        const newText = truncateText(normalizeValue(newValues[field]), 60);
                        return (
                          <p key={`${log.id}-${field}-detail`} className="text-xs text-slate-200">
                            <span className="font-medium text-slate-100">{toFieldLabel(field)}:</span>{" "}
                            {renderChangeText(log, oldText, newText)}
                          </p>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

