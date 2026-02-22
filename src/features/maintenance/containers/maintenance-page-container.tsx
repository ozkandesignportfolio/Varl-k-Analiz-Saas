"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  MaintenanceHeader,
} from "@/features/maintenance/components/maintenance-header";
import {
  MaintenanceSummaryCards,
  type SummaryFilter,
} from "@/features/maintenance/components/maintenance-summary-cards";
import { RuleEditorModal } from "@/features/maintenance/components/rule-editor-modal";
import { RulesTable } from "@/features/maintenance/components/rules-table";
import type {
  MaintenanceAssetOption,
  MaintenanceRuleView,
  RuleEditorValues,
  RulePeriodFilter,
  RuleStatusFilter,
} from "@/features/maintenance/components/types";
import { UpcomingOverdueList } from "@/features/maintenance/components/upcoming-overdue-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listIdName } from "@/lib/repos/assets-repo";
import {
  todayDateInputValue,
  type IntervalUnit,
} from "@/lib/maintenance/next-due";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const intervalUnitLabel: Record<IntervalUnit, string> = {
  day: "Gün",
  week: "Hafta",
  month: "Ay",
  year: "Yıl",
};

const createInitialFormState = (assetId = ""): RuleEditorValues => ({
  assetId,
  title: "",
  intervalValue: "6",
  intervalUnit: "month",
  lastServiceDate: todayDateInputValue(),
  autoResetOnService: true,
});

type AlertsFilter = "all" | "upcoming" | "overdue";
type MaintenanceTab = "alerts" | "rules";

export function MaintenancePageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<MaintenanceAssetOption[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(true);
  const [feedback, setFeedback] = useState("");

  const [activeTab, setActiveTab] = useState<MaintenanceTab>("alerts");
  const [alertsFilter, setAlertsFilter] = useState<AlertsFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [assetFilter, setAssetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<RuleStatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<RulePeriodFilter>("all");

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleModalMode, setRuleModalMode] = useState<"create" | "edit">("create");
  const [ruleModalInitialValues, setRuleModalInitialValues] = useState<RuleEditorValues>(() =>
    createInitialFormState(),
  );
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isRuleSaving, setIsRuleSaving] = useState(false);

  const fetchAssets = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listIdName(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      setAssets((data ?? []) as MaintenanceAssetOption[]);
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
        .order("next_due_date", { ascending: true })
        .order("created_at", { ascending: false });

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

  useEffect(() => {
    const queryAssetId = searchParams.get("assetId") ?? searchParams.get("asset");
    if (!queryAssetId || queryAssetId === assetFilter) {
      return;
    }

    setAssetFilter(queryAssetId);
    setActiveTab("rules");
  }, [assetFilter, searchParams]);

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const todayIso = todayDateInputValue();
  const ruleViews = useMemo<MaintenanceRuleView[]>(() => {
    return rules.map((rule) => {
      const daysToDue = getDaysToDue(rule.next_due_date, todayIso);
      const dueTone: MaintenanceRuleView["dueTone"] = !rule.is_active
        ? "passive"
        : daysToDue <= 0
          ? "overdue"
          : daysToDue <= 7
            ? "soon"
            : "safe";

      return {
        id: rule.id,
        assetId: rule.asset_id,
        assetName: assetNameById.get(rule.asset_id) ?? "Silinmiş varlık",
        title: rule.title,
        intervalValue: rule.interval_value,
        intervalUnit: rule.interval_unit,
        intervalLabel: `${rule.interval_value} ${intervalUnitLabel[rule.interval_unit]}`,
        lastServiceDate: rule.last_service_date,
        nextDueDate: rule.next_due_date,
        isActive: rule.is_active,
        daysToDue,
        dueTone,
      };
    });
  }, [assetNameById, rules, todayIso]);

  const upcomingRules = useMemo(
    () =>
      ruleViews
        .filter((rule) => rule.isActive && rule.daysToDue >= 1 && rule.daysToDue <= 7)
        .sort((a, b) => a.daysToDue - b.daysToDue),
    [ruleViews],
  );

  const overdueRules = useMemo(
    () =>
      ruleViews
        .filter((rule) => rule.isActive && rule.daysToDue <= 0)
        .sort((a, b) => a.daysToDue - b.daysToDue),
    [ruleViews],
  );

  const filteredTableRules = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");

    return ruleViews
      .filter((rule) => {
        if (assetFilter && rule.assetId !== assetFilter) return false;
        if (statusFilter === "active" && !rule.isActive) return false;
        if (statusFilter === "passive" && rule.isActive) return false;
        if (periodFilter !== "all" && rule.intervalUnit !== periodFilter) return false;
        if (normalizedSearch) {
          const target = `${rule.title} ${rule.assetName}`.toLocaleLowerCase("tr-TR");
          if (!target.includes(normalizedSearch)) return false;
        }
        return true;
      })
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }, [assetFilter, periodFilter, ruleViews, searchTerm, statusFilter]);

  const visibleUpcomingRules = alertsFilter === "overdue" ? [] : upcomingRules;
  const visibleOverdueRules = alertsFilter === "upcoming" ? [] : overdueRules;

  const openCreateModal = () => {
    setRuleModalMode("create");
    setEditingRuleId(null);
    setRuleModalInitialValues(createInitialFormState(assetFilter));
    setIsRuleModalOpen(true);
  };

  const openEditModal = (rule: MaintenanceRuleView) => {
    setRuleModalMode("edit");
    setEditingRuleId(rule.id);
    setRuleModalInitialValues({
      assetId: rule.assetId,
      title: rule.title,
      intervalValue: String(rule.intervalValue),
      intervalUnit: rule.intervalUnit,
      lastServiceDate: rule.lastServiceDate ?? todayDateInputValue(),
      autoResetOnService: true,
    });
    setIsRuleModalOpen(true);
    setFeedback("");
  };

  const handleRuleModalSubmit = async (values: RuleEditorValues) => {
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const intervalValue = Number(values.intervalValue);
    if (!values.assetId || !values.title.trim() || !values.lastServiceDate) {
      setFeedback("Varlık, kural adı ve başlangıç tarihi zorunludur.");
      return;
    }

    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      setFeedback("Periyot değeri pozitif bir tam sayı olmalıdır.");
      return;
    }

    setIsRuleSaving(true);
    setFeedback("");

    try {
      const url =
        ruleModalMode === "create" || !editingRuleId
          ? "/api/maintenance-rules"
          : `/api/maintenance-rules/${editingRuleId}`;
      const method = ruleModalMode === "create" || !editingRuleId ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: values.assetId,
          title: values.title.trim(),
          intervalValue,
          intervalUnit: values.intervalUnit,
          lastServiceDate: values.lastServiceDate,
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFeedback(result?.error ?? "Bakım kuralı kaydedilemedi.");
        return;
      }

      setFeedback(ruleModalMode === "create" ? "Bakım kuralı oluşturuldu." : "Bakım kuralı güncellendi.");
      setIsRuleModalOpen(false);
      setEditingRuleId(null);
      await fetchRules(userId);
    } finally {
      setIsRuleSaving(false);
    }
  };

  const handleToggleRuleStatus = async (rule: MaintenanceRuleView) => {
    setFeedback("");
    const response = await fetch(`/api/maintenance-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback(result?.error ?? "Durum değişikliği kaydedilemedi.");
      return;
    }

    setRules((prev) =>
      prev.map((item) => (item.id === rule.id ? { ...item, is_active: !item.is_active } : item)),
    );
  };

  const handleDeleteRule = async (rule: MaintenanceRuleView) => {
    const accepted = window.confirm(`"${rule.title}" kuralını silmek istediğinize emin misiniz?`);
    if (!accepted) {
      return;
    }

    setFeedback("");
    const response = await fetch(`/api/maintenance-rules/${rule.id}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setFeedback(result?.error ?? "Kural silinemedi.");
      return;
    }

    setRules((prev) => prev.filter((item) => item.id !== rule.id));
    setFeedback("Bakım kuralı silindi.");
  };

  const handleSummaryView = (filter: SummaryFilter) => {
    if (filter === "total") {
      setActiveTab("rules");
      setAlertsFilter("all");
      return;
    }

    setActiveTab("alerts");
    setAlertsFilter(filter);
  };

  if (!hasValidSession) {
    return null;
  }

  return (
    <AppShell title="Bakım Planı">
      <div className="space-y-4">
        <MaintenanceHeader onCreateRule={openCreateModal} />

        <MaintenanceSummaryCards
          totalCount={ruleViews.length}
          upcomingCount={upcomingRules.length}
          overdueCount={overdueRules.length}
          onView={handleSummaryView}
        />

        {feedback ? (
          <p className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {feedback}
          </p>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as MaintenanceTab)}
          className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3 shadow-[0_10px_22px_rgba(2,6,23,0.32)]"
        >
          <TabsList className="w-full justify-start bg-slate-900/80 p-1">
            <TabsTrigger
              value="alerts"
              className="text-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
            >
              Yaklaşan & Geciken
            </TabsTrigger>
            <TabsTrigger
              value="rules"
              className="text-slate-300 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
            >
              Kurallar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-3 space-y-3">
            {alertsFilter !== "all" ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900/75 px-3 py-2">
                <p className="text-sm text-slate-300">
                  Filtre: {alertsFilter === "upcoming" ? "Yaklaşan bakımlar" : "Geciken bakımlar"}
                </p>
                <button
                  type="button"
                  onClick={() => setAlertsFilter("all")}
                  className="rounded-md border border-slate-500/80 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  Filtreyi Kaldır
                </button>
              </div>
            ) : null}

            <UpcomingOverdueList
              isLoading={isLoading}
              upcomingRules={visibleUpcomingRules}
              overdueRules={visibleOverdueRules}
              onEditRule={openEditModal}
            />

            <p className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-3 text-sm text-slate-300">
              Servis kaydı bir kurala bağlı eklendiğinde sistem kuralın baz tarihini otomatik günceller
              ve sonraki bakımı yeniden hesaplar.
            </p>
          </TabsContent>

          <TabsContent value="rules" className="mt-3">
            <RulesTable
              isLoading={isLoading}
              rules={filteredTableRules}
              assets={assets}
              searchTerm={searchTerm}
              assetFilter={assetFilter}
              statusFilter={statusFilter}
              periodFilter={periodFilter}
              onSearchTermChange={setSearchTerm}
              onAssetFilterChange={setAssetFilter}
              onStatusFilterChange={setStatusFilter}
              onPeriodFilterChange={setPeriodFilter}
              onClearFilters={() => {
                setSearchTerm("");
                setAssetFilter("");
                setStatusFilter("all");
                setPeriodFilter("all");
              }}
              onEditRule={openEditModal}
              onToggleRuleStatus={handleToggleRuleStatus}
              onDeleteRule={handleDeleteRule}
            />
          </TabsContent>
        </Tabs>
      </div>

      <RuleEditorModal
        key={`${ruleModalMode}-${editingRuleId ?? "new"}-${isRuleModalOpen ? "open" : "closed"}`}
        open={isRuleModalOpen}
        mode={ruleModalMode}
        assets={assets}
        initialValues={ruleModalInitialValues}
        isSubmitting={isRuleSaving}
        onOpenChange={setIsRuleModalOpen}
        onSubmit={handleRuleModalSubmit}
      />
    </AppShell>
  );
}

function getDaysToDue(targetIso: string, todayIso: string) {
  const target = toDateOnlyUtc(targetIso);
  const today = toDateOnlyUtc(todayIso);
  if (!target || !today) {
    return 0;
  }
  return Math.floor((target.getTime() - today.getTime()) / DAY_IN_MS);
}

function toDateOnlyUtc(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}
