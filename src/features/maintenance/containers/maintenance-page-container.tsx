"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import {
  MaintenanceRuleForm,
  type RuleFormState,
} from "@/features/maintenance/components/maintenance-rule-form";
import {
  MaintenanceRulesTable,
  type MaintenanceRuleRow,
} from "@/features/maintenance/components/maintenance-rules-table";
import { listIdName } from "@/lib/repos/assets-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  calculateNextDueDate,
  todayDateInputValue,
  type IntervalUnit,
} from "@/lib/maintenance/next-due";

type AssetOption = {
  id: string;
  name: string;
};

type RuleRow = MaintenanceRuleRow;

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

export function MaintenancePageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [createForm, setCreateForm] = useState<RuleFormState>(() => createInitialFormState());
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RuleFormState>(() => createInitialFormState());

  const fetchAssets = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listIdName(supabase, { userId: currentUserId });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setAssets((data ?? []) as AssetOption[]);
    },
    [supabase],
  );

  const fetchRules = useCallback(
    async (currentUserId: string) => {
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
    },
    [supabase],
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasValidSession(false);
        router.replace("/login");
        setIsLoading(false);
        return;
      }

      setHasValidSession(true);
      setUserId(user.id);
      await Promise.all([fetchAssets(user.id), fetchRules(user.id)]);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, fetchRules, router, supabase]);

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

  if (!hasValidSession) {
    return null;
  }

  return (
    <AppShell
      badge="Bakım Motoru"
      title="Bakım Kurallari"
      subtitle="Interval bazli kural tanimlayin, due tarihini otomatik hesaplayin ve kurallari aktif/pasif yönetin."
    >
      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <MaintenanceRuleForm
          mode="create"
          assets={assets}
          form={createForm}
          setForm={setCreateForm}
          onSubmit={onCreateRule}
          isSubmitting={isSaving}
          duePreview={createNextDuePreview}
          inputClassName={inputClassName}
          intervalUnitOptions={intervalUnitOptions}
        />

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
        <MaintenanceRuleForm
          mode="edit"
          assets={assets}
          form={editForm}
          setForm={setEditForm}
          onSubmit={onUpdateRule}
          isSubmitting={isUpdating}
          duePreview={editNextDuePreview}
          inputClassName={inputClassName}
          intervalUnitOptions={intervalUnitOptions}
          onCancel={onCancelEdit}
        />
      ) : null}

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      <MaintenanceRulesTable
        isLoading={isLoading}
        rules={rules}
        assetNameById={assetNameById}
        getDueBadge={getDueBadge}
        onStartEdit={onStartEdit}
        onToggleRuleStatus={onToggleRuleStatus}
      />

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

