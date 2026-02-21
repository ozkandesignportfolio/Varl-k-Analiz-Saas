"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { GuidedEmptyState } from "@/components/guided-empty-state";
import { usePlanContext } from "@/contexts/PlanContext";
import {
  ServiceLogForm,
  type ServiceLogFormAssetOption,
} from "@/features/services/components/service-log-form";
import {
  ServiceLogTable,
  type ServiceLogTableRow,
} from "@/features/services/components/service-log-table";
import { listIdName } from "@/lib/repos/assets-repo";
import { listForServicesPage as listRulesForServicesPage } from "@/lib/repos/maintenance-rules-repo";
import { listForServicesPage as listServiceLogsForServicesPage } from "@/lib/repos/service-logs-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AssetOption = ServiceLogFormAssetOption;

type RuleOption = {
  id: string;
  asset_id: string;
  title: string;
  is_active: boolean;
  next_due_date: string;
};

type ServiceRow = ServiceLogTableRow;

const serviceTypes = ["Periyodik Bakım", "Arıza Onarım", "Temizlik", "Parça Değişimi", "Diğer"];

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export function ServicesPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const { refreshPlanState } = usePlanContext();

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rules, setRules] = useState<RuleOption[]>([]);
  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [filterAssetId, setFilterAssetId] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

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
      const { data, error } = await listRulesForServicesPage(supabase, { userId: currentUserId });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setRules((data ?? []) as RuleOption[]);
    },
    [supabase],
  );

  const fetchLogs = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listServiceLogsForServicesPage(supabase, { userId: currentUserId });

      if (error) {
        setFeedback(error.message);
        return;
      }

      setLogs((data ?? []) as ServiceRow[]);
    },
    [supabase],
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

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
      await Promise.all([fetchAssets(user.id), fetchRules(user.id), fetchLogs(user.id)]);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, fetchLogs, fetchRules, router, supabase]);

  const activeRulesForSelectedAsset = useMemo(
    () => rules.filter((rule) => rule.is_active && rule.asset_id === selectedAssetId),
    [rules, selectedAssetId],
  );

  useEffect(() => {
    if (selectedRuleId && !activeRulesForSelectedAsset.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId("");
    }
  }, [activeRulesForSelectedAsset, selectedRuleId]);

  const onCreateServiceLog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    const form = event.currentTarget;

    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const formData = new FormData(form);
    const assetId = selectedAssetId;
    const ruleId = selectedRuleId;
    const serviceType = String(formData.get("serviceType") ?? "").trim();
    const serviceDate = String(formData.get("serviceDate") ?? "").trim();
    const costRaw = String(formData.get("cost") ?? "").trim();
    const provider = String(formData.get("provider") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const cost = Number(costRaw || "0");

    if (!assetId || !serviceType || !serviceDate) {
      setFeedback("Varlık, servis türü ve servis tarihi zorunludur.");
      return;
    }

    if (Number.isNaN(cost) || cost < 0) {
      setFeedback("Maliyet geçersiz.");
      return;
    }

    setIsSaving(true);

    try {
      const createResponse = await fetch("/api/service-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          ruleId: ruleId || null,
          serviceType,
          serviceDate,
          cost,
          provider: provider || null,
          notes: notes || null,
        }),
      });

      const createPayload = (await createResponse.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;
      const insertedLogId = createPayload?.id;

      if (!createResponse.ok || !insertedLogId) {
        setFeedback(createPayload?.error ?? "Servis kaydı oluşturulamadı.");
        return;
      }

      form.reset();
      setSelectedAssetId("");
      setSelectedRuleId("");
      setFeedback(
        `${
          ruleId
            ? "Servis kaydı eklendi ve bağlı kuralın tarihleri otomatik sıfırlandı."
            : "Servis kaydı eklendi."
        } Belge yuklemek icin /documents ekranini kullanin.`,
      );

      await Promise.all([fetchLogs(userId), fetchRules(userId)]);
      await refreshPlanState();
      setAuditRefreshKey((prev) => prev + 1);
    } catch {
      setFeedback("Servis kaydı işlenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const ruleNameById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.title])), [rules]);

  const hasActiveFilters = Boolean(filterAssetId || filterStartDate || filterEndDate);

  const isDateRangeInvalid = Boolean(filterStartDate && filterEndDate && filterStartDate > filterEndDate);

  const filteredLogs = useMemo(() => {
    if (isDateRangeInvalid) {
      return [];
    }

    return logs.filter((log) => {
      if (filterAssetId && log.asset_id !== filterAssetId) return false;
      if (filterStartDate && log.service_date < filterStartDate) return false;
      if (filterEndDate && log.service_date > filterEndDate) return false;
      return true;
    });
  }, [filterAssetId, filterEndDate, filterStartDate, isDateRangeInvalid, logs]);

  const totalCost = useMemo(
    () => filteredLogs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0),
    [filteredLogs],
  );

  const serviceTypeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of filteredLogs) {
      map.set(log.service_type, (map.get(log.service_type) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [filteredLogs]);

  const maxDistributionCount = useMemo(
    () => Math.max(1, ...serviceTypeDistribution.map((item) => item.count)),
    [serviceTypeDistribution],
  );

  const focusCreateServiceForm = useCallback(() => {
    const createForm = document.getElementById("service-log-form");
    if (!createForm) return;

    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLSelectElement>("select")?.focus();
  }, []);

  if (!hasValidSession) {
    return null;
  }

  return (
    <AppShell
      badge="Servis Takibi"
      title="Servis Kayıtları"
      subtitle="Servis kayıtlarini varlık bazinda yönetin, kurallarla ilişkilendirin ve tarih resetini otomatik calistirin."
    >
      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <div id="service-log-form">
          <ServiceLogForm
            mode="create"
            assets={assets}
            activeRulesForSelectedAsset={activeRulesForSelectedAsset}
            selectedAssetId={selectedAssetId}
            selectedRuleId={selectedRuleId}
            onSelectedAssetIdChange={(assetId) => {
              setSelectedAssetId(assetId);
              setSelectedRuleId("");
            }}
            onSelectedRuleIdChange={setSelectedRuleId}
            onSubmit={onCreateServiceLog}
            isSubmitting={isSaving}
            isSubmitDisabled={assets.length === 0}
            serviceTypes={serviceTypes}
            inputClassName={inputClassName}
          />
        </div>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Servis Özeti</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryItem label={hasActiveFilters ? "Gorunen Kayit" : "Toplam Kayit"} value={String(filteredLogs.length)} />
            <SummaryItem
              label={hasActiveFilters ? "Gorunen Maliyet" : "Toplam Maliyet"}
              value={`${totalCost.toFixed(2)} TL`}
            />
            <SummaryItem label="Varlik" value={String(new Set(filteredLogs.map((log) => log.asset_id)).size)} />
          </div>
          {hasActiveFilters ? (
            <p className="mt-2 text-xs text-slate-300">Toplam kayit: {logs.length}</p>
          ) : null}
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-200">Tür Dağılımı</h3>
            {serviceTypeDistribution.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">Henüz servis kaydı bulunmuyor.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {serviceTypeDistribution.map((item) => {
                  const width = Math.max(8, (item.count / maxDistributionCount) * 100);
                  return (
                    <div key={item.type}>
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>{item.type}</span>
                        <span>{item.count}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="premium-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Listeleme Filtreleri</h2>
            <p className="mt-1 text-sm text-slate-300">Varlik ve tarih araligi ile servis kayitlarini filtreleyin.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilterAssetId("");
              setFilterStartDate("");
              setFilterEndDate("");
            }}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Filtreyi Temizle
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-200">
            <span className="mb-1.5 block text-sm text-slate-300">Varlik</span>
            <select
              value={filterAssetId}
              onChange={(event) => setFilterAssetId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Tum Varliklar</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            <span className="mb-1.5 block text-sm text-slate-300">Baslangic Tarihi</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(event) => setFilterStartDate(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="text-sm text-slate-200">
            <span className="mb-1.5 block text-sm text-slate-300">Bitis Tarihi</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(event) => setFilterEndDate(event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>
        {isDateRangeInvalid ? (
          <p className="mt-3 text-sm text-amber-300">Baslangic tarihi, bitis tarihinden sonra olamaz.</p>
        ) : (
          <p className="mt-3 text-sm text-slate-300">
            {filteredLogs.length} kayit listeleniyor{hasActiveFilters ? ` / ${logs.length} toplam kayit` : "."}
          </p>
        )}
      </section>

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      <ServiceLogTable
        isLoading={isLoading}
        logs={filteredLogs}
        assetNameById={assetNameById}
        ruleNameById={ruleNameById}
        emptyState={
          !isLoading ? (
            hasActiveFilters ? (
              <p className="mt-4 text-sm text-slate-300">
                Secili filtrelere uygun servis kaydi bulunamadi. Filtreyi genisletmeyi deneyin.
              </p>
            ) : (
              assets.length === 0 ? (
                <GuidedEmptyState
                  title="Servis kaydı için önce varlık gerekli"
                  description="Yeni kullanıcılar demo veri ile gelir. Eğer liste boşsa önce varlık oluşturup sonra servis kaydı ekleyebilirsin."
                  primaryAction={{ label: "Varlıklara git", href: "/assets" }}
                  secondaryAction={{ label: "Dashboard ac", href: "/dashboard" }}
                />
              ) : (
                <GuidedEmptyState
                  title="İlk servis kaydını ekle"
                  description="Servis formunu doldurarak maliyet ve tarih takibini hemen başlat."
                  primaryAction={{ label: "Servis formuna git", onClick: focusCreateServiceForm }}
                />
              )
            )
          ) : undefined
        }
      />

      <AuditHistoryPanel
        title="Servis ve Kural Audit Geçmişi"
        subtitle="Servis kayıtlari ve tetiklenen bakım kural degisikliklerini alan bazinda inceleyin."
        entityTypes={["service_logs", "maintenance_rules"]}
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

