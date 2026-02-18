"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatStorageBytes, getPlanConfig, getUserPlanConfig, type PlanConfig } from "@/lib/plans/plan-config";
import { listIdName } from "@/lib/repos/assets-repo";
import { listForDocumentsPage } from "@/lib/repos/documents-repo";
import { createClient } from "@/lib/supabase/client";

type DocumentRow = {
  id: string;
  asset_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  uploaded_at: string;
};

type AssetRow = {
  id: string;
  name: string;
};

const sizeFormatter = new Intl.NumberFormat("tr-TR");
const DEFAULT_PLAN_CONFIG: PlanConfig = getPlanConfig("starter");

export default function DocumentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [planConfig, setPlanConfig] = useState<PlanConfig>(DEFAULT_PLAN_CONFIG);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setFeedback(userError?.message ?? "Oturum bulunamadi. Lutfen tekrar giris yapin.");
        setIsLoading(false);
        return;
      }

      setPlanConfig(getUserPlanConfig(user));

      const [docsRes, assetsRes] = await Promise.all([
        listForDocumentsPage(supabase, { userId: user.id }),
        listIdName(supabase, { userId: user.id }),
      ]);

      if (docsRes.error) setFeedback(docsRes.error.message);
      if (assetsRes.error) setFeedback(assetsRes.error.message);

      setDocuments((docsRes.data ?? []) as DocumentRow[]);
      setAssets((assetsRes.data ?? []) as AssetRow[]);
      setIsLoading(false);
    };

    void load();
  }, [supabase]);

  const getExtension = (fileName: string) => {
    const parts = fileName.toLowerCase().split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  };

  const canPreview = (doc: DocumentRow) => {
    const previewableExtensions = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "svg"]);
    return previewableExtensions.has(getExtension(doc.file_name));
  };

  const onPreview = async (doc: DocumentRow) => {
    if (!canPreview(doc)) {
      setFeedback("Bu dosya turu icin onizleme desteklenmiyor.");
      return;
    }

    setPreviewingId(doc.id);
    const { data, error } = await supabase.storage.from("documents-private").createSignedUrl(doc.storage_path, 60 * 5);

    if (error || !data?.signedUrl) {
      setFeedback(error?.message ?? "Onizleme baglantisi olusturulamadi.");
      setPreviewingId(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setPreviewingId(null);
  };

  const onDownload = async (doc: DocumentRow) => {
    setDownloadingId(doc.id);

    const { data, error } = await supabase.storage.from("documents-private").download(doc.storage_path);

    if (error || !data) {
      setFeedback(error?.message ?? "Dosya indirilemedi.");
      setDownloadingId(null);
      return;
    }

    const objectUrl = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = doc.file_name || "belge";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    setDownloadingId(null);
  };

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const documentTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documents) {
      map.set(doc.document_type, (map.get(doc.document_type) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [documents]);

  const totalSize = useMemo(() => documents.reduce((sum, doc) => sum + Number(doc.file_size ?? 0), 0), [documents]);
  const storageUsageText =
    planConfig.limits.maxDocumentStorageBytes === null
      ? `${formatStorageBytes(totalSize)} / yuksek limit`
      : `${formatStorageBytes(totalSize)} / ${formatStorageBytes(planConfig.limits.maxDocumentStorageBytes)}`;

  return (
    <AppShell badge="Belge Kasasi" title="Belgeler" subtitle="Belge ozeti ve liste yalnizca veritabanindaki gercek kayitlari gosterir.">
      {feedback ? (
        <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {feedback}
        </p>
      ) : null}

      <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
        Plan: {planConfig.label}. Belge depolama kullanimi: {storageUsageText}
      </p>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Toplam Belge" value={String(documents.length)} />
        <SummaryCard label="Belge Turu" value={String(documentTypeCounts.length)} />
        <SummaryCard label="Toplam Boyut" value={`${sizeFormatter.format(totalSize)} bayt`} />
      </section>

      <section className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Belge Turu Dagilimi</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
        ) : documentTypeCounts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Henuz belge kaydi yok.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {documentTypeCounts.map((item) => {
              const maxCount = documentTypeCounts[0]?.count || 1;
              const width = Math.max(8, (item.count / maxCount) * 100);
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{item.type}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="premium-card p-5">
        <h2 className="text-xl font-semibold text-white">Belge Listesi</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yukleniyor...</p>
        ) : documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Henuz belge bulunmuyor.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                  <th className="px-3 py-2">Dosya Adi</th>
                  <th className="px-3 py-2">Tur</th>
                  <th className="px-3 py-2">Varlik</th>
                  <th className="px-3 py-2">Boyut</th>
                  <th className="px-3 py-2">Yukleme Tarihi</th>
                  <th className="px-3 py-2">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-white/10 text-slate-100">
                    <td className="px-3 py-3">{doc.file_name}</td>
                    <td className="px-3 py-3">{doc.document_type}</td>
                    <td className="px-3 py-3">{assetNameById.get(doc.asset_id) ?? "-"}</td>
                    <td className="px-3 py-3">{sizeFormatter.format(doc.file_size ?? 0)} bayt</td>
                    <td className="px-3 py-3">{new Date(doc.uploaded_at).toLocaleDateString("tr-TR")}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void onPreview(doc)}
                          disabled={previewingId === doc.id}
                          className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {previewingId === doc.id ? "Hazirlaniyor..." : "Onizle"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {downloadingId === doc.id ? "Indiriliyor..." : "Indir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}
