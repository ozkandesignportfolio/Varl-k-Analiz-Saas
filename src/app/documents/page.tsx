"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/shared/page-header";
import { PanelSurface } from "@/components/shared/panel-surface";
import { usePlanContext } from "@/contexts/PlanContext";
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
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

type UploadApiResponse = {
  ok?: boolean;
  id?: string;
  error?: string;
};

const sizeFormatter = new Intl.NumberFormat("tr-TR");
const DEFAULT_DOCUMENT_TYPE = "garanti";

const documentTypeOptions = [
  { value: "garanti", label: "Garanti" },
  { value: "fatura", label: "Fatura" },
  { value: "servis_formu", label: "Servis Formu" },
  { value: "diğer", label: "Diğer" },
] as const;

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const fileInputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white";

type FeedbackTone = "info" | "error" | "success";

export default function DocumentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { plan } = usePlanContext();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedDocumentType, setSelectedDocumentType] = useState(DEFAULT_DOCUMENT_TYPE);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("info");
  const planConfig = useMemo(() => getPlanConfigFromProfilePlan(plan), [plan]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFeedback("");
    setFeedbackTone("info");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setFeedback(userError?.message ?? "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      setFeedbackTone("error");
      setIsLoading(false);
      return;
    }

    const [docsRes, assetsRes] = await Promise.all([
      listForDocumentsPage(supabase, { userId: user.id }),
      listIdName(supabase, { userId: user.id }),
    ]);

    if (docsRes.error) {
      setFeedback(docsRes.error.message);
      setFeedbackTone("error");
    } else if (assetsRes.error) {
      setFeedback(assetsRes.error.message);
      setFeedbackTone("error");
    }

    setDocuments((docsRes.data ?? []) as DocumentRow[]);
    setAssets((assetsRes.data ?? []) as AssetRow[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      setFeedback("Bu dosya türü için önizleme desteklenmiyor.");
      setFeedbackTone("error");
      return;
    }

    setPreviewingId(doc.id);
    const { data, error } = await supabase.storage.from("documents-private").createSignedUrl(doc.storage_path, 60 * 5);

    if (error || !data?.signedUrl) {
      setFeedback(error?.message ?? "önizleme bağlantısı oluşturulamadı.");
      setFeedbackTone("error");
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
      setFeedbackTone("error");
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

  const onUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    setFeedbackTone("info");

    if (!selectedAssetId) {
      setFeedback("Belge yüklemek için önce bir varlık seçin.");
      setFeedbackTone("error");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedFile = formData.get("file");

    if (!(selectedFile instanceof File) || selectedFile.size <= 0) {
      setFeedback("Lütfen yüklenecek bir dosya seçin.");
      setFeedbackTone("error");
      return;
    }

    formData.set("assetId", selectedAssetId);
    formData.set("documentType", selectedDocumentType);

    setIsUploading(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as UploadApiResponse | null;
      if (!response.ok || !payload?.ok) {
        setFeedback(payload?.error ?? "Belge yüklenemedi.");
        setFeedbackTone("error");
        return;
      }

      setFeedback("Belge yüklendi.");
      setFeedbackTone("success");
      form.reset();
      setSelectedAssetId("");
      setSelectedDocumentType(DEFAULT_DOCUMENT_TYPE);
      await loadData();
    } catch {
      setFeedback("Belge yükleme sırasında beklenmeyen bir hata oluştu.");
      setFeedbackTone("error");
    } finally {
      setIsUploading(false);
    }
  };

  const feedbackClassName =
    feedbackTone === "error"
      ? "rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
      : feedbackTone === "success"
        ? "rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100"
        : "rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100";

  const assetNameById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const documentTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documents) {
      map.set(doc.document_type, (map.get(doc.document_type) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [documents]);

  const totalSize = useMemo(() => documents.reduce((sum, doc) => sum + Number(doc.file_size ?? 0), 0), [documents]);
  const documentsLimit = planConfig.limits.documentsLimit;
  const documentUsageText = documentsLimit === null ? `${documents.length}/sınırsız` : `${documents.length}/${documentsLimit}`;

  return (
    <AppShell
      badge="Belge Kasası"
      title="Belgeler"
      subtitle="Resmi belge yükleme akışı bu sayfadan ilerler. Belge özeti ve liste gerçek kayıtları gösterir."
    >
      <PanelSurface>
        <PageHeader title="Belge Kasası" subtitle="Belge yükleme, depolama özetleri ve belge listesi." />

        {feedback ? <p className={feedbackClassName}>{feedback}</p> : null}

        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          Paket: {planConfig.label}. Belge limiti kullanımı: {documentUsageText}
        </p>

        <section className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Belge Yükleme</h2>
          <p className="mt-2 text-sm text-slate-300">
            Resmi belge yükleme akışı bu ekranda standartlaştırıldı.
          </p>

          <form onSubmit={onUpload} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Varlık</span>
              <select
                required
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                className={inputClassName}
                disabled={assets.length === 0}
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
              <span className="mb-1.5 block text-sm text-slate-300">Belge Tipi</span>
              <select
                required
                value={selectedDocumentType}
                onChange={(event) => setSelectedDocumentType(event.target.value)}
                className={inputClassName}
              >
                {documentTypeOptions.map((item) => (
                  <option key={item.value} value={item.value} className="bg-slate-900">
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Dosya</span>
              <input
                name="file"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm,video/x-matroska,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,audio/ogg"
                className={fileInputClassName}
              />
            </label>

            <div className="md:col-span-2 pt-1">
              <button
                type="submit"
                disabled={isUploading || assets.length === 0}
                className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUploading ? "Yükleniyor..." : "Belge Yükle"}
              </button>
            </div>
          </form>

          {assets.length === 0 ? (
            <p className="mt-3 text-sm text-amber-200">Belge yüklemek için önce bir varlık oluşturmalısınız.</p>
          ) : null}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Toplam Belge" value={String(documents.length)} />
          <SummaryCard label="Belge Türü" value={String(documentTypeCounts.length)} />
          <SummaryCard label="Toplam Boyut" value={`${sizeFormatter.format(totalSize)} bayt`} />
        </section>

        <section className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Belge Türü Dağılımı</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : documentTypeCounts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Henüz belge kaydı yok.</p>
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
            <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
          ) : documents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">Henüz belge bulunmuyor.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                    <th className="px-3 py-2">Dosya Adı</th>
                    <th className="px-3 py-2">Tür</th>
                    <th className="px-3 py-2">Varlık</th>
                    <th className="px-3 py-2">Boyut</th>
                    <th className="px-3 py-2">Yükleme Tarihi</th>
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
                            {previewingId === doc.id ? "Hazırlanıyor..." : "Önizle"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {downloadingId === doc.id ? "İndiriliyor..." : "İndir"}
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
      </PanelSurface>
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
