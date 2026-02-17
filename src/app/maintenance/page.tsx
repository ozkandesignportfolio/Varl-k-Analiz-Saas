"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { createClient } from "@/lib/supabase/client";
import {
  calculateNextDueDate,
  todayDateInputValue,
  type IntervalUnit,
} from "@/lib/maintenance/next-due";

type AssetOption = {
  id: string;
  name: string;
};

type RuleRow = {
  id: string;
  asset_id: string;
  title: string;
  interval_value: number;
  interval_unit: IntervalUnit;
  last_service_date: string | null;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
};

type RuleFormState = {
  assetId: string;
  title: string;
  intervalValue: string;
  intervalUnit: IntervalUnit;
  lastServiceDate: string;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const intervalUnitOptions: { value: IntervalUnit; label: string }[] = [
  { value: "day", label: "Gün" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Ay" },
  { value: "year", label: "Yıl" },
];

const createInitialFormState = (): RuleFormState => ({
  assetId: "",
  title: "",
  intervalValue: "6",
  intervalUnit: "month",
  lastServiceDate: todayDateInputValue(),
});

const getDueBadge = (rule: RuleRow) => {
  if (!rule.is_active) {
    return { label: "Pasif", className: "border-white/20 bg-white/5 text-slate-300" };
  }

  const today = todayDateInputValue();
  const nextWeek = calculateNextDueDate({
    baseDate: today,
    intervalValue: 7,
    intervalUnit: "day",
  });

  if (rule.next_due_date < today) {
    return { label: "Gecikmiş", className: "border-rose-300/35 bg-rose-300/10 text-rose-100" };
  }

  if (rule.next_due_date <= nextWeek) {
    return { label: "Yaklaşıyor", className: "border-amber-300/35 bg-amber-300/10 text-amber-100" };
  }

  return { label: "Planlı", className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" };
};

export default function MaintenancePage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [createForm, setCreateForm] = useState<RuleFormState>(() => createInitialFormState());
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RuleFormState>(() => createInitialFormState());

  const fetchAssets = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("assets")
      .select("id,name")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setFeedback(error.message);
      return;
    }

    setAssets((data ?? []) as AssetOption[]);
  }, [supabase]);

  const fetchRules = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("maintenance_rules")
      .select(
        "id,asset_id,title,interval_value,interval_unit,last_service_date,next_due_date,is_active,created_at",
      )
      .eq("user_id", currentUserId)
      .order("next_due_date", { ascending: true });

    if (error) {
      setFeedback(error.message);
      return;
    }

    setRules((data ?? []) as RuleRow[]);
  }, [supabase]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFeedback("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      await Promise.all([fetchAssets(user.id), fetchRules(user.id)]);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, fetchRules, supabase]);

  const createNextDuePreview = useMemo(() => {
    try {
      return calculateNextDueDate({
        baseDate: createForm.lastServiceDate,
        intervalValue: Number(createForm.intervalValue),
        intervalUnit: createForm.intervalUnit,
      });
    } catch {
      return "-";
    }
  }, [createForm.intervalUnit, createForm.intervalValue, createForm.lastServiceDate]);

  const editNextDuePreview = useMemo(() => {
    if (!editingRuleId) return "-";

    try {
      return calculateNextDueDate({
        baseDate: editForm.lastServiceDate,
        intervalValue: Number(editForm.intervalValue),
        intervalUnit: editForm.intervalUnit,
      });
    } catch {
      return "-";
    }
  }, [editForm.intervalUnit, editForm.intervalValue, editForm.lastServiceDate, editingRuleId]);

  const assetNameById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets],
  );

  const onCreateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");

    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const intervalValue = Number(createForm.intervalValue);
    if (!createForm.assetId || !createForm.title.trim() || !createForm.lastServiceDate) {
      setFeedback("Varlık, başlık ve baz tarih zorunludur.");
      return;
    }

    try {
      calculateNextDueDate({
        baseDate: createForm.lastServiceDate,
        intervalValue,
        intervalUnit: createForm.intervalUnit,
      });
    } catch (error) {
      setFeedback((error as Error).message);
      return;
    }

    setIsSaving(true);

    const response = await fetch("/api/maintenance-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: createForm.assetId,
        title: createForm.title.trim(),
        intervalValue,
        intervalUnit: createForm.intervalUnit,
        lastServiceDate: createForm.lastServiceDate,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback(result?.error ?? "Bakım kuralı kaydedilemedi.");
      setIsSaving(false);
      return;
    }

    setCreateForm(createInitialFormState());
    setFeedback("Bakım kuralı oluşturuldu.");
    await fetchRules(userId);
    setAuditRefreshKey((prev) => prev + 1);
    setIsSaving(false);
  };

  const onStartEdit = (rule: RuleRow) => {
    setEditingRuleId(rule.id);
    setEditForm({
      assetId: rule.asset_id,
      title: rule.title,
      intervalValue: String(rule.interval_value),
      intervalUnit: rule.interval_unit,
      lastServiceDate: rule.last_service_date ?? todayDateInputValue(),
    });
    setFeedback("");
  };

  const onCancelEdit = () => {
    setEditingRuleId(null);
  };

  const onUpdateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRuleId) return;
    setFeedback("");

    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const intervalValue = Number(editForm.intervalValue);
    if (!editForm.assetId || !editForm.title.trim() || !editForm.lastServiceDate) {
      setFeedback("Varlık, başlık ve baz tarih zorunludur.");
      return;
    }

    try {
      calculateNextDueDate({
        baseDate: editForm.lastServiceDate,
        intervalValue,
        intervalUnit: editForm.intervalUnit,
      });
    } catch (error) {
      setFeedback((error as Error).message);
      return;
    }

    setIsUpdating(true);
    const response = await fetch(`/api/maintenance-rules/${editingRuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: editForm.assetId,
        title: editForm.title.trim(),
        intervalValue,
        intervalUnit: editForm.intervalUnit,
        lastServiceDate: editForm.lastServiceDate,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback(result?.error ?? "Bakım kuralı güncellenemedi.");
      setIsUpdating(false);
      return;
    }

    setEditingRuleId(null);
    setFeedback("Bakım kuralı güncellendi.");
    await fetchRules(userId);
    setAuditRefreshKey((prev) => prev + 1);
    setIsUpdating(false);
  };

  const onToggleRuleStatus = async (rule: RuleRow) => {
    setFeedback("");
    const response = await fetch(`/api/maintenance-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.is_active }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback(result?.error ?? "Durum degisikligi kaydedilemedi.");
      return;
    }

    setRules((prev) =>
      prev.map((item) => (item.id === rule.id ? { ...item, is_active: !item.is_active } : item)),
    );
    setAuditRefreshKey((prev) => prev + 1);
  };

  return (
    <AppShell
      badge="Bakım Motoru"
      title="Bakım Kurallari"
      subtitle="Interval bazli kural tanimlayin, due tarihini otomatik hesaplayin ve kurallari aktif/pasif yönetin."
    >
      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Yeni Kural Oluştur</h2>
          <form onSubmit={onCreateRule} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
              <select
                required
                className={inputClassName}
                value={createForm.assetId}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, assetId: event.target.value }))
                }
              >
                <option value="" disabled className="bg-slate-900">
                  Varlık seçin
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id} className="bg-slate-900">
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Kural Basligi</span>
              <input
                required
                className={inputClassName}
                placeholder="Örnek: Filtre Değişimi"
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Interval Degeri</span>
              <input
                required
                type="number"
                min={1}
                step={1}
                className={inputClassName}
                value={createForm.intervalValue}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, intervalValue: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Interval Birimi</span>
              <select
                className={inputClassName}
                value={createForm.intervalUnit}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    intervalUnit: event.target.value as IntervalUnit,
                  }))
                }
              >
                {intervalUnitOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Baz Tarih</span>
              <input
                required
                type="date"
                className={inputClassName}
                value={createForm.lastServiceDate}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, lastServiceDate: event.target.value }))
                }
              />
            </label>

            <div className="md:col-span-2 rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
              Hesaplanan sonraki bakım tarihi: <strong>{createNextDuePreview}</strong>
            </div>

            <div className="md:col-span-2 pt-1">
              <button
                type="submit"
                disabled={isSaving || assets.length === 0}
                className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Kaydediliyor..." : "Kuralı Oluştur"}
              </button>
            </div>
          </form>
        </article>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Kural Özeti</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryItem label="Toplam Kural" value={String(rules.length)} />
            <SummaryItem
              label="Aktif Kural"
              value={String(rules.filter((rule) => rule.is_active).length)}
            />
            <SummaryItem
              label="Gecikmiş"
              value={String(rules.filter((rule) => getDueBadge(rule).label === "Gecikmiş").length)}
            />
          </div>
          <p className="mt-5 text-sm text-slate-300">
            Servis kaydı bir kuralla ilişkilendirildiğinde kuralın tarihi otomatik resetlenir.
          </p>
        </article>
      </section>

      {editingRuleId ? (
        <section className="premium-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Kuralı Düzenle</h2>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100"
            >
              Vazgec
            </button>
          </div>

          <form onSubmit={onUpdateRule} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
              <select
                required
                className={inputClassName}
                value={editForm.assetId}
                onChange={(event) => setEditForm((prev) => ({ ...prev, assetId: event.target.value }))}
              >
                <option value="" disabled className="bg-slate-900">
                  Varlık seçin
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id} className="bg-slate-900">
                    {asset.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Kural Basligi</span>
              <input
                required
                className={inputClassName}
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Interval Degeri</span>
              <input
                required
                type="number"
                min={1}
                step={1}
                className={inputClassName}
                value={editForm.intervalValue}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, intervalValue: event.target.value }))
                }
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Interval Birimi</span>
              <select
                className={inputClassName}
                value={editForm.intervalUnit}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    intervalUnit: event.target.value as IntervalUnit,
                  }))
                }
              >
                {intervalUnitOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Baz Tarih</span>
              <input
                required
                type="date"
                className={inputClassName}
                value={editForm.lastServiceDate}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, lastServiceDate: event.target.value }))
                }
              />
            </label>

            <div className="md:col-span-2 rounded-xl border border-indigo-300/25 bg-indigo-300/10 px-4 py-3 text-sm text-indigo-100">
              Hesaplanan sonraki bakım tarihi: <strong>{editNextDuePreview}</strong>
            </div>

            <div className="md:col-span-2 pt-1">
              <button
                type="submit"
                disabled={isUpdating}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUpdating ? "Güncelleniyor..." : "Güncellemeyi Kaydet"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

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
                          <button
                            type="button"
                            onClick={() => onToggleRuleStatus(rule)}
                            className="rounded-full border border-white/25 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                          >
                            {rule.is_active ? "Pasif Et" : "Aktif Et"}
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

      <AuditHistoryPanel
        title="Bakım ve Servis Değişim Geçmişi"
        subtitle="Bakım kuralı ve servis akışında oluşan tüm değişimleri kim/ne zaman/alan bazında izleyin."
        entityTypes={["maintenance_rules", "service_logs"]}
        limit={15}
        refreshKey={auditRefreshKey}
      />
    </AppShell>
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


