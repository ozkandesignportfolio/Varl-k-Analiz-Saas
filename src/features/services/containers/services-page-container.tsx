"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { GuidedEmptyState } from "@/components/shared/guided-empty-state";
import { usePlanContext } from "@/contexts/PlanContext";
import {
  ServiceLogForm,
  type ServiceLogFormAssetOption,
} from "@/features/services/components/service-log-form";
import {
  ServiceLogTable,
  type ServiceLogTableRow,
} from "@/features/services/components/service-log-table";
import { listForServiceLogForm } from "@/lib/repos/assets-repo";
import { listForServicesPage as listRulesForServicesPage } from "@/lib/repos/maintenance-rules-repo";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AssetOption = ServiceLogFormAssetOption;

type AssetOptionRow = {
  id: string;
  name: string;
  category: string | null;
  serial_number: string | null;
};

type RuleOption = {
  id: string;
  asset_id: string;
  title: string;
  is_active: boolean;
  next_due_date: string;
};

type ServiceRow = ServiceLogTableRow;
type ServiceLogsCursor = {
  createdAt: string;
  id: string;
};
type ServiceLogsPageResponse = {
  rows: ServiceRow[];
  nextCursor: ServiceLogsCursor | null;
  hasMore: boolean;
};

const serviceTypes = ["Periyodik Bakım", "Arıza Onarımı", "Temizlik", "Parça Değişimi", "Diğer"];

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const SERVICES_PAGE_SIZE = 50;

export function ServicesPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshPlanState, userId: planUserId, isLoading: isPlanLoading } = usePlanContext();
  const initializedUserIdRef = useRef<string | null>(null);
  const logsFetchInFlightRef = useRef(new Set<string>());
  const logsQueryVersionRef = useRef(0);
  const replaceLogsAbortRef = useRef<AbortController | null>(null);
  const skipNextLogsEffectRef = useRef(false);

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rules, setRules] = useState<RuleOption[]>([]);
  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [logsCursor, setLogsCursor] = useState<ServiceLogsCursor | null>(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [isLoadingMoreLogs, setIsLoadingMoreLogs] = useState(false);
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

  const isCurrentLogsQueryVersion = useCallback(
    (queryVersion: number) => logsQueryVersionRef.current === queryVersion,
    [],
  );

  const fetchAssets = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listForServiceLogForm(supabase, { userId: currentUserId });

      if (error) {
        setFeedback("Varlık seçenekleri yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
        return;
      }

      setAssets(
        ((data ?? []) as AssetOptionRow[]).map((asset) => ({
          id: asset.id,
          name: asset.name,
          label: [asset.name, asset.category, asset.serial_number ? `SN: ${asset.serial_number}` : null]
            .filter((value) => Boolean(value && value.trim().length > 0))
            .join(" • "),
        })),
      );
    },
    [supabase],
  );

  const fetchRules = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listRulesForServicesPage(supabase, { userId: currentUserId });

      if (error) {
        setFeedback("Bakım kuralı seçenekleri yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
        return;
      }

      setRules((data ?? []) as RuleOption[]);
    },
    [supabase],
  );

  const fetchLogs = useCallback(
    async (
      options?: {
        append?: boolean;
        cursor?: ServiceLogsCursor | null;
        assetId?: string;
        startDate?: string;
        endDate?: string;
      },
    ) => {
      const isAppend = options?.append === true;
      const requestKey = [
        isAppend ? "append" : "replace",
        options?.cursor?.createdAt ?? "",
        options?.cursor?.id ?? "",
        options?.assetId ?? "",
        options?.startDate ?? "",
        options?.endDate ?? "",
      ].join("|");

      if (logsFetchInFlightRef.current.has(requestKey)) {
        return;
      }
      logsFetchInFlightRef.current.add(requestKey);

      const queryVersion = isAppend ? logsQueryVersionRef.current : logsQueryVersionRef.current + 1;
      let requestAbortController: AbortController | null = null;

      if (isAppend) {
        if (queryVersion === 0) {
          logsFetchInFlightRef.current.delete(requestKey);
          return;
        }
      } else {
        logsQueryVersionRef.current = queryVersion;
        replaceLogsAbortRef.current?.abort();
        requestAbortController = new AbortController();
        replaceLogsAbortRef.current = requestAbortController;
      }

      if (!isAppend) {
        setIsLoading(true);
        setIsLoadingMoreLogs(false);
      } else {
        setIsLoadingMoreLogs(true);
      }

      try {
        const query = new URLSearchParams();
        query.set("pageSize", String(SERVICES_PAGE_SIZE));
        if (options?.assetId) query.set("assetId", options.assetId);
        if (options?.startDate) query.set("startDate", options.startDate);
        if (options?.endDate) query.set("endDate", options.endDate);
        if (options?.cursor?.createdAt) query.set("cursorCreatedAt", options.cursor.createdAt);
        if (options?.cursor?.id) query.set("cursorId", options.cursor.id);

        const response = await fetch(`/api/service-logs?${query.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: requestAbortController?.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | (ServiceLogsPageResponse & { error?: never })
          | { error?: string }
          | null;

        if (!isCurrentLogsQueryVersion(queryVersion)) {
          return;
        }

        if (!response.ok) {
          setFeedback(payload?.error ?? "Servis kayıtları yüklenemedi.");
          return;
        }

        const pageData: ServiceLogsPageResponse = {
          rows: payload && "rows" in payload && Array.isArray(payload.rows) ? payload.rows : [],
          nextCursor:
            payload && "nextCursor" in payload && payload.nextCursor ? payload.nextCursor : null,
          hasMore: Boolean(payload && "hasMore" in payload && payload.hasMore),
        };
        const rows = (pageData.rows ?? []) as ServiceRow[];
        setHasMoreLogs((prev) => (prev === pageData.hasMore ? prev : pageData.hasMore));
        setLogsCursor((prev) => {
          const next = pageData.nextCursor;
          if (!prev && !next) return prev;
          if (prev && next && prev.createdAt === next.createdAt && prev.id === next.id) return prev;
          return next;
        });
        if (!isAppend) {
          setLogs(rows);
        } else {
          setLogs((prev) => [...prev, ...rows]);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!isCurrentLogsQueryVersion(queryVersion)) {
          return;
        }
        setFeedback("Servis kayıtları yüklenemedi.");
      } finally {
        logsFetchInFlightRef.current.delete(requestKey);
        if (!isAppend && replaceLogsAbortRef.current === requestAbortController) {
          replaceLogsAbortRef.current = null;
        }
        if (!isCurrentLogsQueryVersion(queryVersion)) {
          return;
        }
        if (!isAppend) {
          setIsLoading(false);
        } else {
          setIsLoadingMoreLogs(false);
        }
      }
    },
    [isCurrentLogsQueryVersion],
  );

  const initializePageUser = useCallback(
    async (currentUserId: string) => {
      if (initializedUserIdRef.current === currentUserId) {
        return;
      }

      initializedUserIdRef.current = currentUserId;
      skipNextLogsEffectRef.current = true;
      setHasValidSession(true);
      setUserId(currentUserId);
      await Promise.all([
        fetchAssets(currentUserId),
        fetchRules(currentUserId),
        fetchLogs({
          assetId: filterAssetId || undefined,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
        }),
      ]);
      setIsLoading(false);
    },
    [fetchAssets, fetchLogs, fetchRules, filterAssetId, filterEndDate, filterStartDate],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isPlanLoading) {
        setIsLoading((prev) => (prev ? prev : true));
        return;
      }

      setIsLoading(true);

      let resolvedUserId = planUserId;
      if (!resolvedUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        resolvedUserId = user?.id ?? null;
      }

      if (cancelled) {
        return;
      }

      if (!resolvedUserId) {
        initializedUserIdRef.current = null;
        setHasValidSession(false);
        router.replace("/login");
        setIsLoading(false);
        return;
      }

      await initializePageUser(resolvedUserId);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [initializePageUser, isPlanLoading, planUserId, router, supabase]);

  useEffect(() => {
    if (assets.length === 0 || selectedAssetId) {
      return;
    }

    const queryAssetId = searchParams.get("assetId");
    if (!queryAssetId) {
      return;
    }

    const hasAsset = assets.some((asset) => asset.id === queryAssetId);
    if (hasAsset) {
      setSelectedAssetId(queryAssetId);
    }
  }, [assets, searchParams, selectedAssetId]);

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
        } Belge yüklemek için /documents ekranını kullanın.`,
      );

      await Promise.all([
        fetchLogs({
          assetId: filterAssetId || undefined,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
        }),
        fetchRules(userId),
      ]);
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

  useEffect(() => {
    if (!userId) {
      return;
    }

    if (skipNextLogsEffectRef.current) {
      skipNextLogsEffectRef.current = false;
      return;
    }

    if (isDateRangeInvalid) {
      setLogs((prev) => (prev.length === 0 ? prev : []));
      setHasMoreLogs(false);
      setLogsCursor(null);
      return;
    }

    void fetchLogs({
      assetId: filterAssetId || undefined,
      startDate: filterStartDate || undefined,
      endDate: filterEndDate || undefined,
    });
  }, [fetchLogs, filterAssetId, filterEndDate, filterStartDate, isDateRangeInvalid, userId]);

  useEffect(
    () => () => {
      replaceLogsAbortRef.current?.abort();
    },
    [],
  );

  const filteredLogs = useMemo(() => {
    if (isDateRangeInvalid) {
      return [];
    }

    return logs;
  }, [isDateRangeInvalid, logs]);

  const logsSummary = useMemo(() => {
    const visibleAssetIds = new Set<string>();
    const serviceTypeCounts = new Map<string, number>();
    let totalCost = 0;

    for (const log of filteredLogs) {
      totalCost += Number(log.cost ?? 0);
      visibleAssetIds.add(log.asset_id);
      serviceTypeCounts.set(log.service_type, (serviceTypeCounts.get(log.service_type) ?? 0) + 1);
    }

    return {
      totalCost,
      visibleAssetCount: visibleAssetIds.size,
      serviceTypeDistribution: [...serviceTypeCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    };
  }, [filteredLogs]);

  const serviceTypeDistribution = useMemo(
    () => logsSummary?.serviceTypeDistribution ?? [],
    [logsSummary],
  );

  const maxDistributionCount = useMemo(() => {
    if (!serviceTypeDistribution.length) return 1;
    return Math.max(...serviceTypeDistribution.map((item) => item.count));
  }, [serviceTypeDistribution]);

  const summaryMetrics = useMemo(
    () => ({
      visibleRecordCount: filteredLogs.length,
      visibleCostLabel: `${logsSummary.totalCost.toFixed(2)} TL`,
      visibleAssetCount: logsSummary.visibleAssetCount,
      totalRecordCount: logs.length,
    }),
    [filteredLogs.length, logs.length, logsSummary.totalCost, logsSummary.visibleAssetCount],
  );

  const focusCreateServiceForm = useCallback(() => {
    const createForm = document.getElementById("service-log-form");
    if (!createForm) return;

    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLSelectElement>("select")?.focus();
  }, []);

  const onClearFilters = useCallback(() => {
    setFilterAssetId("");
    setFilterStartDate("");
    setFilterEndDate("");
  }, []);

  const onSelectedAssetIdChange = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    setSelectedRuleId("");
  }, []);

  const filterAssetOptions = useMemo(
    () =>
      assets.map((asset) => (
        <option key={asset.id} value={asset.id}>
          {asset.name}
        </option>
      )),
    [assets],
  );

  const loadMoreLogs = useCallback(async () => {
    if (!userId || isDateRangeInvalid || !hasMoreLogs || isLoadingMoreLogs || !logsCursor) {
      return;
    }

    await fetchLogs({
      append: true,
      cursor: logsCursor,
      assetId: filterAssetId || undefined,
      startDate: filterStartDate || undefined,
      endDate: filterEndDate || undefined,
    });
  }, [
    fetchLogs,
    filterAssetId,
    filterEndDate,
    filterStartDate,
    hasMoreLogs,
    isDateRangeInvalid,
    isLoadingMoreLogs,
    logsCursor,
    userId,
  ]);

  const onLoadMoreClick = useCallback(() => {
    void loadMoreLogs();
  }, [loadMoreLogs]);

  const serviceLogEmptyState = useMemo<ReactNode>(() => {
    if (isLoading) {
      return undefined;
    }

    if (hasActiveFilters) {
      return (
        <p className="mt-4 text-sm text-slate-300">
          Seçili filtrelere uygun servis kaydı bulunamadı. Filtreyi genişletmeyi deneyin.
        </p>
      );
    }

    if (assets.length === 0) {
      return (
        <GuidedEmptyState
          title="Servis kaydı için önce varlık gerekli"
          description="Liste boşsa önce varlık oluşturup sonra servis kaydı ekleyebilirsin."
          primaryAction={{ label: "Varlıklara git", href: "/assets" }}
          secondaryAction={{ label: "Dashboard aç", href: "/dashboard" }}
        />
      );
    }

    return (
      <GuidedEmptyState
        title="İlk servis kaydını ekle"
        description="Servis formunu doldurarak maliyet ve tarih takibini hemen başlat."
        primaryAction={{ label: "Servis formuna git", onClick: focusCreateServiceForm }}
      />
    );
  }, [assets.length, focusCreateServiceForm, hasActiveFilters, isLoading]);

  if (!hasValidSession) {
    return null;
  }

  return (
    <AppShell
      badge="Servis Takibi"
      title="Servis Kayıtları"
      subtitle="Servis kayıtlarını varlık bazında yönetin, kurallarla ilişkilendirin ve tarih resetini otomatik çalıştırın."
    >
      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]" data-testid="services-form-section">
        <div id="service-log-form" data-testid="services-form-anchor">
          <ServiceLogForm
            mode="create"
            assets={assets}
            activeRulesForSelectedAsset={activeRulesForSelectedAsset}
            hasAnyRules={rules.length > 0}
            selectedAssetId={selectedAssetId}
            selectedRuleId={selectedRuleId}
            onSelectedAssetIdChange={onSelectedAssetIdChange}
            onSelectedRuleIdChange={setSelectedRuleId}
            onSubmit={onCreateServiceLog}
            isSubmitting={isSaving}
            isSubmitDisabled={assets.length === 0}
            serviceTypes={serviceTypes}
            inputClassName={inputClassName}
          />
        </div>

        <ServiceSummaryCard
          hasActiveFilters={hasActiveFilters}
          visibleRecordCount={summaryMetrics.visibleRecordCount}
          visibleCostLabel={summaryMetrics.visibleCostLabel}
          visibleAssetCount={summaryMetrics.visibleAssetCount}
          totalRecordCount={summaryMetrics.totalRecordCount}
          serviceTypeDistribution={serviceTypeDistribution}
          maxDistributionCount={maxDistributionCount}
        />
      </section>

      <section className="premium-card p-5" data-testid="services-filter-section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Listeleme Filtreleri</h2>
            <p className="mt-1 text-sm text-slate-300">Varlık ve tarih aralığı ile servis kayıtlarını filtreleyin.</p>
          </div>
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Filtreyi Temizle
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm text-slate-200">
            <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
            <select
              value={filterAssetId}
              onChange={(event) => setFilterAssetId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Tüm Varlıklar</option>
              {filterAssetOptions}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            <span className="mb-1.5 block text-sm text-slate-300">Başlangıç Tarihi</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(event) => setFilterStartDate(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="text-sm text-slate-200">
            <span className="mb-1.5 block text-sm text-slate-300">Bitiş Tarihi</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(event) => setFilterEndDate(event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>
        {isDateRangeInvalid ? (
          <p className="mt-3 text-sm text-amber-300">Başlangıç tarihi, bitiş tarihinden sonra olamaz.</p>
        ) : (
          <p className="mt-3 text-sm text-slate-300">
            {filteredLogs.length} kayıt listeleniyor.
          </p>
        )}
      </section>

      {feedback ? (
        <p
          className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100"
          data-testid="services-feedback"
        >
          {feedback}
        </p>
      ) : null}

      <ServiceLogTable
        isLoading={isLoading}
        logs={filteredLogs}
        assetNameById={assetNameById}
        ruleNameById={ruleNameById}
        emptyState={serviceLogEmptyState}
      />

      {!isDateRangeInvalid && hasMoreLogs ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMoreClick}
            disabled={isLoadingMoreLogs}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreLogs ? "Yükleniyor..." : "Daha Fazla Kayıt"}
          </button>
        </div>
      ) : null}

      <AuditHistoryPanel
        title="Servis ve Kural Geçmişi"
        subtitle="Eklenen, güncellenen ve silinen servis/kural işlemlerini sade şekilde görün."
        entityTypes={["service_logs", "maintenance_rules"]}
        limit={15}
        refreshKey={auditRefreshKey}
      />
    </AppShell>
  );
}

const ServiceSummaryCard = memo(function ServiceSummaryCard({
  hasActiveFilters,
  visibleRecordCount,
  visibleCostLabel,
  visibleAssetCount,
  totalRecordCount,
  serviceTypeDistribution,
  maxDistributionCount,
}: {
  hasActiveFilters: boolean;
  visibleRecordCount: number;
  visibleCostLabel: string;
  visibleAssetCount: number;
  totalRecordCount: number;
  serviceTypeDistribution: { type: string; count: number }[];
  maxDistributionCount: number;
}) {
  return (
    <article className="premium-card p-5">
      <h2 className="text-xl font-semibold text-white">Servis Özeti</h2>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SummaryItem label={hasActiveFilters ? "Görünen Kayıt" : "Toplam Kayıt"} value={String(visibleRecordCount)} />
        <SummaryItem label={hasActiveFilters ? "Görünen Maliyet" : "Toplam Maliyet"} value={visibleCostLabel} />
        <SummaryItem label="Varlık" value={String(visibleAssetCount)} />
      </div>
      {hasActiveFilters ? (
        <p className="mt-2 text-xs text-slate-300">Toplam kayıt: {totalRecordCount}</p>
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
  );
});

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </article>
  );
}



