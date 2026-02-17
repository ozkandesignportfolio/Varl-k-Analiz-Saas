"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { createClient } from "@/lib/supabase/client";

type AssetOption = {
  id: string;
  name: string;
};

type RuleOption = {
  id: string;
  asset_id: string;
  title: string;
  is_active: boolean;
  next_due_date: string;
};

type ServiceRow = {
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

type ServiceMediaApiResponse = {
  ok?: boolean;
  uploadedCount?: number;
  transcription?: string | null;
  suggestedDescription?: string | null;
  warnings?: string[];
  error?: string;
};

const serviceTypes = [
  "Periyodik Bakım",
  "Arıza Onarım",
  "Temizlik",
  "Parça Değişimi",
  "Diğer",
];

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const fileInputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white";

const getSelectedFile = (entry: FormDataEntryValue | null): File | null =>
  entry instanceof File && entry.size > 0 ? entry : null;

export default function ServicesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [rules, setRules] = useState<RuleOption[]>([]);
  const [logs, setLogs] = useState<ServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");

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
      .select("id,asset_id,title,is_active,next_due_date")
      .eq("user_id", currentUserId)
      .order("next_due_date", { ascending: true });

    if (error) {
      setFeedback(error.message);
      return;
    }

    setRules((data ?? []) as RuleOption[]);
  }, [supabase]);

  const fetchLogs = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("service_logs")
      .select("id,asset_id,rule_id,service_type,service_date,cost,provider,notes,created_at")
      .eq("user_id", currentUserId)
      .order("service_date", { ascending: false });

    if (error) {
      setFeedback(error.message);
      return;
    }

    setLogs((data ?? []) as ServiceRow[]);
  }, [supabase]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFeedback("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      await Promise.all([fetchAssets(user.id), fetchRules(user.id), fetchLogs(user.id)]);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, fetchLogs, fetchRules, supabase]);

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

        const mediaPayload = (await mediaResponse.json().catch(() => null)) as ServiceMediaApiResponse | null;

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

  const assetNameById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets],
  );

  const ruleNameById = useMemo(
    () => new Map(rules.map((rule) => [rule.id, rule.title])),
    [rules],
  );

  const totalCost = useMemo(
    () => logs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0),
    [logs],
  );

  const serviceTypeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      map.set(log.service_type, (map.get(log.service_type) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [logs]);

  const maxDistributionCount = useMemo(
    () => Math.max(1, ...serviceTypeDistribution.map((item) => item.count)),
    [serviceTypeDistribution],
  );

  return (
    <AppShell
      badge="Servis Takibi"
      title="Servis Kayıtları"
      subtitle="Servis kayıtlarini varlık bazinda yönetin, kurallarla ilişkilendirin ve tarih resetini otomatik calistirin."
    >
      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Yeni Servis Kaydı</h2>
          <form onSubmit={onCreateServiceLog} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
              <select
                required
                value={selectedAssetId}
                onChange={(event) => {
                  setSelectedAssetId(event.target.value);
                  setSelectedRuleId("");
                }}
                className={inputClassName}
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
              <span className="mb-1.5 block text-sm text-slate-300">Bakım Kuralı (Opsiyonel)</span>
              <select
                value={selectedRuleId}
                onChange={(event) => setSelectedRuleId(event.target.value)}
                className={inputClassName}
                disabled={!selectedAssetId}
              >
                <option value="" className="bg-slate-900">
                  Kural seçmeden devam et
                </option>
                {activeRulesForSelectedAsset.map((rule) => (
                  <option key={rule.id} value={rule.id} className="bg-slate-900">
                    {rule.title} (due: {rule.next_due_date})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Servis Türü</span>
              <select name="serviceType" required defaultValue="" className={inputClassName}>
                <option value="" disabled className="bg-slate-900">
                  Tür seçin
                </option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type} className="bg-slate-900">
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Servis Tarihi</span>
              <input name="serviceDate" type="date" required className={inputClassName} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Maliyet (TL)</span>
              <input
                name="cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Servis Sağlayıcı</span>
              <input name="provider" className={inputClassName} placeholder="Örnek: Yetkili Servis" />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Not</span>
              <textarea
                name="notes"
                rows={3}
                className={inputClassName}
                placeholder="Ek notlar"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Fotograf (Opsiyonel)</span>
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" className={fileInputClassName} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Video (Opsiyonel)</span>
              <input name="video" type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" className={fileInputClassName} />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Ses Notu (Opsiyonel)</span>
              <input name="audio" type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,audio/ogg" className={fileInputClassName} />
              <span className="mt-1.5 block text-xs text-slate-400">
                Maksimum dosya boyutu: 50 MB. Yüklenen medya servis kaydına bağlı olarak saklanır.
              </span>
            </label>

            <div className="md:col-span-2 pt-1">
              <button
                type="submit"
                disabled={isSaving || assets.length === 0}
                className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Kaydediliyor..." : "Servis Kaydını Ekle"}
              </button>
            </div>
          </form>
        </article>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Servis Özeti</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryItem label="Toplam Kayıt" value={String(logs.length)} />
            <SummaryItem label="Toplam Maliyet" value={`${totalCost.toFixed(2)} TL`} />
            <SummaryItem
              label="Varlık"
              value={String(new Set(logs.map((log) => log.asset_id)).size)}
            />
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

      <section className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Servis Geçmişi</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : logs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Henüz servis kaydı yok.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Varlık</th>
                  <th className="px-3 py-2">Kural</th>
                  <th className="px-3 py-2">Tür</th>
                  <th className="px-3 py-2">Maliyet</th>
                  <th className="px-3 py-2">Sağlayıcı</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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


