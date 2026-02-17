"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { KpiTrendDashboard } from "@/components/kpi/kpi-trend-dashboard";
import { createClient } from "@/lib/supabase/client";

type AssetRow = {
  id: string;
  name: string;
  category: string;
  warranty_end_date: string | null;
};

type ServiceLogRow = {
  id: string;
  asset_id: string;
  rule_id: string | null;
  service_type: string;
  service_date: string;
  cost: number;
};

type RuleRow = {
  id: string;
  asset_id: string;
  next_due_date: string;
  is_active: boolean;
};

type DocumentRow = {
  id: string;
};

type PredictionItem = {
  assetId: string;
  assetName: string;
  category: string;
  predictedMaintenanceDate: string | null;
  riskScore: number;
  confidence: number;
  basis: string;
  recommendedAction: string;
  overdueDays: number | null;
};

type PredictionApiResponse = {
  generatedAt: string;
  model: string;
  warning?: string;
  items: PredictionItem[];
};

const parseDateOnly = (value: string) => {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
};

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLogRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [predictionMeta, setPredictionMeta] = useState<{
    generatedAt: string;
    model: string;
    warning?: string;
  } | null>(null);
  const [predictionError, setPredictionError] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");
      setPredictionError("");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        setFeedback("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        setIsLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      const predictionRequest = fetch("/api/maintenance-predictions", {
        method: "GET",
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as
            | PredictionApiResponse
            | { error?: string }
            | null;

          if (!response.ok) {
            throw new Error(
              body && "error" in body
                ? body.error || "Tahmin verisi alınamadı."
                : "Tahmin verisi alınamadı.",
            );
          }

          return body as PredictionApiResponse;
        })
        .then((data) => ({ data, error: "" }))
        .catch((error: Error) => ({ data: null, error: error.message }));

      const [assetsRes, logsRes, rulesRes, docsRes, predictionRes] = await Promise.all([
        supabase.from("assets").select("id,name,category,warranty_end_date").eq("user_id", user.id),
        supabase
          .from("service_logs")
          .select("id,asset_id,rule_id,service_type,service_date,cost")
          .eq("user_id", user.id),
        supabase
          .from("maintenance_rules")
          .select("id,asset_id,next_due_date,is_active")
          .eq("user_id", user.id),
        supabase.from("documents").select("id").eq("user_id", user.id),
        predictionRequest,
      ]);

      if (assetsRes.error) setFeedback(assetsRes.error.message);
      if (logsRes.error) setFeedback(logsRes.error.message);
      if (rulesRes.error) setFeedback(rulesRes.error.message);
      if (docsRes.error) setFeedback(docsRes.error.message);

      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setServiceLogs((logsRes.data ?? []) as ServiceLogRow[]);
      setRules((rulesRes.data ?? []) as RuleRow[]);
      setDocuments((docsRes.data ?? []) as DocumentRow[]);
      setPredictions((predictionRes.data?.items ?? []) as PredictionItem[]);
      setPredictionMeta(
        predictionRes.data
          ? {
              generatedAt: predictionRes.data.generatedAt,
              model: predictionRes.data.model,
              warning: predictionRes.data.warning,
            }
          : null,
      );

      if (predictionRes.error) {
        setPredictionError(predictionRes.error);
      }

      setIsLoading(false);
    };

    void load();
  }, [supabase]);

  const onSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const upcomingDueCount = useMemo(() => {
    const inSevenDays = new Date(today);
    inSevenDays.setDate(today.getDate() + 7);

    return rules.filter((rule) => {
      if (!rule.is_active || !rule.next_due_date) return false;
      const dueDate = parseDateOnly(rule.next_due_date);
      if (!dueDate) return false;
      return dueDate >= today && dueDate <= inSevenDays;
    }).length;
  }, [rules, today]);

  const overdueCount = useMemo(() => {
    return rules.filter((rule) => {
      if (!rule.is_active || !rule.next_due_date) return false;
      const dueDate = parseDateOnly(rule.next_due_date);
      if (!dueDate) return false;
      return dueDate < today;
    }).length;
  }, [rules, today]);

  const upcomingWarrantyCount = useMemo(() => {
    const inThirtyDays = new Date(today);
    inThirtyDays.setDate(today.getDate() + 30);

    return assets.filter((asset) => {
      if (!asset.warranty_end_date) return false;
      const warrantyEndDate = parseDateOnly(asset.warranty_end_date);
      if (!warrantyEndDate) return false;
      return warrantyEndDate >= today && warrantyEndDate <= inThirtyDays;
    }).length;
  }, [assets, today]);

  const thisMonthCost = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return serviceLogs
      .filter((log) => {
        const d = new Date(log.service_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  }, [serviceLogs]);

  const topPredictions = useMemo(
    () => [...predictions].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6),
    [predictions],
  );

  const highRiskCount = useMemo(
    () => predictions.filter((item) => item.riskScore >= 70).length,
    [predictions],
  );

  const predictionGeneratedAt = useMemo(() => {
    if (!predictionMeta?.generatedAt) return "";
    const parsed = new Date(predictionMeta.generatedAt);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("tr-TR");
  }, [predictionMeta]);

  return (
    <AppShell
      badge="Kontrol Merkezi"
      title="Gösterge Paneli"
      subtitle={
        isLoading
          ? "Veriler yükleniyor..."
          : `Hoş geldiniz, ${email || "kullanıcı"}. Bu ekran gerçek verilerinizle güncellenir.`
      }
      actions={
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Çıkış Yap
        </button>
      }
    >
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      {predictionError ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          AI tahmin servisi şu anda kullanılamıyor: {predictionError}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Varlık Sayısı" value={String(assets.length)} />
        <StatCard label="Yaklaşan Bakım (7 Gün)" value={String(upcomingDueCount)} />
        <StatCard label="Gecikmiş Bakım" value={String(overdueCount)} />
        <StatCard label="Yaklaşan Garanti (30 Gün)" value={String(upcomingWarrantyCount)} />
        <StatCard label="Bu Ay Servis Maliyeti" value={`${thisMonthCost.toFixed(2)} TL`} />
        <StatCard label="Yüksek Riskli Tahmin" value={String(highRiskCount)} />
      </section>

      <KpiTrendDashboard assets={assets} serviceLogs={serviceLogs} rules={rules} isLoading={isLoading} />

      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Özet</h2>
          <div className="mt-4 space-y-2">
            <SummaryRow label="Toplam Servis Kaydı" value={String(serviceLogs.length)} />
            <SummaryRow label="Toplam Belge" value={String(documents.length)} />
            <SummaryRow
              label="Kayıtlı Kategori"
              value={String(new Set(assets.map((asset) => asset.category)).size)}
            />
          </div>
          <div className="mt-5 space-y-2">
            <LinkItem href="/assets" label="Varlıkları Yönet" />
            <LinkItem href="/services" label="Servis Kayıtlarını Gör" />
            <LinkItem href="/documents" label="Belgeleri Aç" />
            <LinkItem href="/costs" label="Maliyet Analizine Git" />
          </div>
        </article>

        <article className="premium-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">AI Bakım Riskleri</h2>
            {predictionMeta?.model ? (
              <p className="text-xs text-slate-400">Model: {predictionMeta.model}</p>
            ) : null}
          </div>
          {predictionGeneratedAt ? (
            <p className="mt-1 text-xs text-slate-400">Üretim zamanı: {predictionGeneratedAt}</p>
          ) : null}
          {predictionMeta?.warning ? (
            <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">
              {predictionMeta.warning}
            </p>
          ) : null}

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : topPredictions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Risk tahmini bulunmuyor.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {topPredictions.map((item) => (
                <div
                  key={`${item.assetId}-${item.predictedMaintenanceDate ?? "none"}-${item.riskScore}`}
                  className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{item.assetName}</p>
                    <RiskBadge score={item.riskScore} />
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{item.recommendedAction}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Güven: %{item.confidence.toFixed(0)}</span>
                    {item.overdueDays !== null ? <span>Gecikme: {item.overdueDays} gün</span> : null}
                    {item.predictedMaintenanceDate ? (
                      <span>Tarih: {new Date(item.predictedMaintenanceDate).toLocaleDateString("tr-TR")}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function LinkItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
    >
      <span>{label}</span>
      <span>{"->"}</span>
    </Link>
  );
}

function RiskBadge({ score }: { score: number }) {
  const normalized = Math.max(0, Math.min(100, score));
  const toneClass =
    normalized >= 70
      ? "border-rose-300/40 bg-rose-300/15 text-rose-100"
      : normalized >= 40
        ? "border-amber-300/40 bg-amber-300/15 text-amber-100"
        : "border-emerald-300/40 bg-emerald-300/15 text-emerald-100";

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass}`}>
      Risk %{normalized.toFixed(0)}
    </span>
  );
}



