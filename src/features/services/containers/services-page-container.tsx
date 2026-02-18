"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { GuidedEmptyState } from "@/components/guided-empty-state";
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

type ServiceMediaApiResponse = {
  ok?: boolean;
  uploadedCount?: number;
  transcription?: string | null;
  suggestedDescription?: string | null;
  warnings?: string[];
  error?: string;
};

const serviceTypes = ["Periyodik Bakım", "Arıza Onarım", "Temizlik", "Parça Değişimi", "Diğer"];

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const fileInputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white";

const getSelectedFile = (entry: FormDataEntryValue | null): File | null =>
  entry instanceof File && entry.size > 0 ? entry : null;

export function ServicesPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

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
    const photoFile = getSelectedFile(formData.get("photo"));
    const videoFile = getSelectedFile(formData.get("video"));
    const audioFile = getSelectedFile(formData.get("audio"));
    const cost = Number(costRaw || "0");
    const hasMedia = Boolean(photoFile || videoFile || audioFile);

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

      let mediaFeedback = "";
      if (hasMedia) {
        const mediaFormData = new FormData();
        mediaFormData.append("assetId", assetId);
        mediaFormData.append("serviceLogId", insertedLogId);
        mediaFormData.append("serviceType", serviceType);
        mediaFormData.append("serviceDate", serviceDate);
        mediaFormData.append("provider", provider);
        mediaFormData.append("notes", notes);

        if (photoFile) mediaFormData.append("photo", photoFile);
        if (videoFile) mediaFormData.append("video", videoFile);
        if (audioFile) mediaFormData.append("audio", audioFile);

        const mediaResponse = await fetch("/api/service-media", {
          method: "POST",
          body: mediaFormData,
        });

        const mediaPayload = (await mediaResponse.json().catch(() => null)) as
          | ServiceMediaApiResponse
          | null;

        if (!mediaResponse.ok) {
          mediaFeedback = mediaPayload?.error
            ? ` Medya yükleme hatası: ${mediaPayload.error}`
            : " Medya yükleme tamamlanamadı.";
        } else {
          const mediaCount = mediaPayload?.uploadedCount ?? 0;
          const warnings = mediaPayload?.warnings?.length
            ? ` Uyarılar: ${mediaPayload.warnings.join(" | ")}`
            : "";
          const aiParts = [
            mediaPayload?.transcription ? "Ses transkripsiyonu notlara eklendi." : null,
            mediaPayload?.suggestedDescription ? "AI açıklama önerisi notlara eklendi." : null,
          ]
            .filter(Boolean)
            .join(" ");

          mediaFeedback = ` ${mediaCount} medya dosyası yüklendi.${aiParts ? ` ${aiParts}` : ""}${warnings}`;
        }
      }

      form.reset();
      setSelectedAssetId("");
      setSelectedRuleId("");
      setFeedback(
        `${
          ruleId
            ? "Servis kaydı eklendi ve bağlı kuralın tarihleri otomatik resetlendi."
            : "Servis kaydı eklendi."
        }${mediaFeedback}`,
      );

      await Promise.all([fetchLogs(userId), fetchRules(userId)]);
      setAuditRefreshKey((prev) => prev + 1);
    } catch {
      setFeedback("Servis kaydı işlenirken beklenmeyen bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const ruleNameById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.title])), [rules]);

  const totalCost = useMemo(() => logs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0), [logs]);

  const serviceTypeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      map.set(log.service_type, (map.get(log.service_type) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [logs]);

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
            fileInputClassName={fileInputClassName}
          />
        </div>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Servis Özeti</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryItem label="Toplam Kayıt" value={String(logs.length)} />
            <SummaryItem label="Toplam Maliyet" value={`${totalCost.toFixed(2)} TL`} />
            <SummaryItem label="Varlık" value={String(new Set(logs.map((log) => log.asset_id)).size)} />
          </div>
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

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      <ServiceLogTable
        isLoading={isLoading}
        logs={logs}
        assetNameById={assetNameById}
        ruleNameById={ruleNameById}
        emptyState={
          !isLoading ? (
            assets.length === 0 ? (
              <GuidedEmptyState
                title="Servis kaydi icin once varlik gerekli"
                description="Yeni kullanicilar demo veri ile gelir. Eger liste bossa once varlik olusturup sonra servis kaydi ekleyebilirsin."
                primaryAction={{ label: "Varliklara git", href: "/assets" }}
                secondaryAction={{ label: "Dashboard ac", href: "/dashboard" }}
              />
            ) : (
              <GuidedEmptyState
                title="Ilk servis kaydini ekle"
                description="Servis formunu doldurarak maliyet ve tarih takibini hemen baslat."
                primaryAction={{ label: "Servis formuna git", onClick: focusCreateServiceForm }}
              />
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
