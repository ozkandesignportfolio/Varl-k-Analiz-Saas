"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { QrScannerModal } from "@/components/qr-scanner-modal";

type AssetRow = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code: string | null;
  created_at: string;
};

const bucketName = "documents-private";

const categoryOptions = [
  "Beyaz Eşya",
  "Isıtma",
  "Soğutma",
  "Elektronik",
  "Mutfak",
  "Diğer",
];

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const toOptionalString = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const toSafeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const isMissingQrCodeError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("qr_code") &&
    (normalized.includes("does not exist") || normalized.includes("could not find the column"))
  );
};

export default function AssetsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fetchAssets = useCallback(async (currentUserId: string) => {
    const { data, error } = await supabase
      .from("assets")
      .select(
        "id,name,category,brand,model,purchase_date,warranty_end_date,photo_path,qr_code,created_at",
      )
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error && isMissingQrCodeError(error.message)) {
      const fallbackRes = await supabase
        .from("assets")
        .select("id,name,category,brand,model,purchase_date,warranty_end_date,photo_path,created_at")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (fallbackRes.error) {
        setFeedback(fallbackRes.error.message);
        return;
      }

      setAssets(
        ((fallbackRes.data ?? []) as Omit<AssetRow, "qr_code">[]).map((item) => ({
          ...item,
          qr_code: null,
        })),
      );
      return;
    }

    if (error) {
      setFeedback(error.message);
      return;
    }

    setAssets((data ?? []) as AssetRow[]);
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
      await fetchAssets(user.id);
      setIsLoading(false);
    };

    void load();
  }, [supabase, fetchAssets]);

  const uploadPhoto = useCallback(
    async (assetId: string, file: File) => {
      const safeName = toSafeFileName(file.name);
      const storagePath = `${userId}/${assetId}/photo-${Date.now()}-${safeName}`;

      const { error } = await supabase.storage.from(bucketName).upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

      if (error) throw error;
      return storagePath;
    },
    [supabase, userId],
  );

  const onCreateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    const form = event.currentTarget;

    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const brand = toOptionalString(formData.get("brand"));
    const model = toOptionalString(formData.get("model"));
    const purchaseDate = toOptionalString(formData.get("purchaseDate"));
    const warrantyEndDate = toOptionalString(formData.get("warrantyEndDate"));
    const photoFile = formData.get("photo");

    if (!name || !category) {
      setFeedback("Varlık adı ve kategori zorunludur.");
      return;
    }

    setIsSaving(true);

    const createRes = await supabase
      .from("assets")
      .insert({
        user_id: userId,
        name,
        category,
        brand,
        model,
        purchase_date: purchaseDate,
        warranty_end_date: warrantyEndDate,
      })
      .select("id")
      .single();

    if (createRes.error || !createRes.data) {
      setFeedback(createRes.error?.message ?? "Varlık kaydı oluşturulamadı.");
      setIsSaving(false);
      return;
    }

    const assetId = createRes.data.id;

    if (photoFile instanceof File && photoFile.size > 0) {
      try {
        const storagePath = await uploadPhoto(assetId, photoFile);
        const updatePhotoRes = await supabase
          .from("assets")
          .update({ photo_path: storagePath })
          .eq("id", assetId);

        if (updatePhotoRes.error) {
          setFeedback(
            `Varlık eklendi, ancak fotoğraf yolu kaydedilemedi: ${updatePhotoRes.error.message}`,
          );
        } else {
          setFeedback("Varlık ve fotoğraf başarıyla eklendi.");
        }
      } catch (error) {
        setFeedback(`Varlık eklendi, ancak fotoğraf yüklenemedi: ${(error as Error).message}`);
      }
    } else {
      setFeedback("Varlık başarıyla eklendi.");
    }

    form.reset();
    await fetchAssets(userId);
    setAuditRefreshKey((prev) => prev + 1);
    setIsSaving(false);
  };

  const onStartEdit = (asset: AssetRow) => {
    setEditingAsset(asset);
    setFeedback("");
  };

  const onCancelEdit = () => {
    setEditingAsset(null);
  };

  const onUpdateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAsset) return;
    const form = event.currentTarget;
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    setFeedback("");
    setIsUpdating(true);

    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const brand = toOptionalString(formData.get("brand"));
    const model = toOptionalString(formData.get("model"));
    const purchaseDate = toOptionalString(formData.get("purchaseDate"));
    const warrantyEndDate = toOptionalString(formData.get("warrantyEndDate"));
    const photoFile = formData.get("photo");

    if (!name || !category) {
      setFeedback("Varlık adı ve kategori zorunludur.");
      setIsUpdating(false);
      return;
    }

    let nextPhotoPath = editingAsset.photo_path;
    let replacedPhotoPath: string | null = null;

    if (photoFile instanceof File && photoFile.size > 0) {
      try {
        nextPhotoPath = await uploadPhoto(editingAsset.id, photoFile);
        replacedPhotoPath = editingAsset.photo_path;
      } catch (error) {
        setFeedback(`Fotoğraf yüklenemedi: ${(error as Error).message}`);
        setIsUpdating(false);
        return;
      }
    }

    const updateRes = await supabase
      .from("assets")
      .update({
        name,
        category,
        brand,
        model,
        purchase_date: purchaseDate,
        warranty_end_date: warrantyEndDate,
        photo_path: nextPhotoPath,
      })
      .eq("id", editingAsset.id)
      .eq("user_id", userId);

    if (updateRes.error) {
      setFeedback(updateRes.error.message);
      setIsUpdating(false);
      return;
    }

    if (replacedPhotoPath && replacedPhotoPath !== nextPhotoPath) {
      await supabase.storage.from(bucketName).remove([replacedPhotoPath]);
    }

    setFeedback("Varlık güncellendi.");
    setEditingAsset(null);
    await fetchAssets(userId);
    setAuditRefreshKey((prev) => prev + 1);
    setIsUpdating(false);
  };

  const onDeleteAsset = async (asset: AssetRow) => {
    const ok = window.confirm("Bu varlığı silmek istiyor musunuz?");
    if (!ok) return;
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const { error } = await supabase
      .from("assets")
      .delete()
      .eq("id", asset.id)
      .eq("user_id", userId);
    if (error) {
      setFeedback(error.message);
      return;
    }

    if (asset.photo_path) {
      await supabase.storage.from(bucketName).remove([asset.photo_path]);
    }

    setAssets((prev) => prev.filter((item) => item.id !== asset.id));
    if (editingAsset?.id === asset.id) {
      setEditingAsset(null);
    }
    setAuditRefreshKey((prev) => prev + 1);
  };

  const onQrDetected = async (code: string) => {
    setFeedback("Kod okunuyor...");
    const normalized = code.trim();
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    if (!normalized) {
      setFeedback("Geçersiz kod okundu.");
      return;
    }

    const res = await supabase
      .from("assets")
      .select("id")
      .eq("qr_code", normalized)
      .eq("user_id", userId)
      .maybeSingle();

    if (res.error) {
      if (isMissingQrCodeError(res.error.message)) {
        setFeedback("QR özelliği henüz aktif değil. QR migration dosyasını çalıştırın.");
        return;
      }
      setFeedback(`Kod sorgulanamadı: ${res.error.message}`);
      return;
    }

    if (!res.data) {
      setFeedback("Bu kodla eşleşen varlık bulunamadı.");
      return;
    }

    setFeedback("");
    router.push(`/assets/${res.data.id}`);
  };

  const categoryDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of assets) {
      map.set(asset.category, (map.get(asset.category) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [assets]);

  const maxCategoryCount = useMemo(
    () => Math.max(1, ...categoryDistribution.map((item) => item.count)),
    [categoryDistribution],
  );

  return (
    <AppShell
      badge="Varlık Yönetimi"
      title="Varlıklar"
      subtitle="Varlık ekleyin, güncelleyin, silin, fotoğraf yükleyin ve QR ile hızlı erişim sağlayın."
      actions={
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
        >
          QR Tara
        </button>
      }
    >
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(value) => {
          void onQrDetected(value);
        }}
      />

      <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Yeni Varlık Ekle</h2>
          <form onSubmit={onCreateAsset} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Varlık Adı</span>
              <input name="name" required className={inputClassName} placeholder="Örnek: Kombi" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Kategori</span>
              <select name="category" required className={inputClassName} defaultValue="">
                <option value="" disabled className="bg-slate-900">
                  Kategori seçin
                </option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option} className="bg-slate-900">
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Marka</span>
              <input name="brand" className={inputClassName} placeholder="Örnek: Bosch" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Model</span>
              <input name="model" className={inputClassName} placeholder="Örnek: X200" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Tarihi</span>
              <input name="purchaseDate" type="date" className={inputClassName} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Garanti Bitiş Tarihi</span>
              <input name="warrantyEndDate" type="date" className={inputClassName} />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Fotoğraf (JPG/PNG)</span>
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png"
                className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
              />
            </label>

            <div className="md:col-span-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Kaydediliyor..." : "Varlığı Kaydet"}
              </button>
            </div>
          </form>
        </article>

        <article className="premium-card p-5">
          <h2 className="text-xl font-semibold text-white">Envanter Özeti</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryItem label="Toplam Varlık" value={String(assets.length)} />
            <SummaryItem
              label="Fotoğraflı Kayıt"
              value={String(assets.filter((asset) => Boolean(asset.photo_path)).length)}
            />
            <SummaryItem
              label="Kategori"
              value={String(new Set(assets.map((asset) => asset.category)).size)}
            />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-200">Kategori Dağılımı</h3>
            {categoryDistribution.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">Henüz varlık kaydı bulunmuyor.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {categoryDistribution.map((item) => {
                  const width = Math.max(8, (item.count / maxCategoryCount) * 100);
                  return (
                    <div key={item.category}>
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span>{item.category}</span>
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
          </div>
        </article>
      </section>

      {editingAsset ? (
        <section className="premium-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Varlık Güncelle</h2>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100"
            >
              Vazgeç
            </button>
          </div>

          <form onSubmit={onUpdateAsset} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Varlık Adı</span>
              <input name="name" defaultValue={editingAsset.name} required className={inputClassName} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Kategori</span>
              <select
                name="category"
                required
                className={inputClassName}
                defaultValue={editingAsset.category}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option} className="bg-slate-900">
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Marka</span>
              <input name="brand" defaultValue={editingAsset.brand ?? ""} className={inputClassName} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Model</span>
              <input name="model" defaultValue={editingAsset.model ?? ""} className={inputClassName} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Satın Alma Tarihi</span>
              <input
                name="purchaseDate"
                type="date"
                defaultValue={editingAsset.purchase_date ?? ""}
                className={inputClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-300">Garanti Bitiş Tarihi</span>
              <input
                name="warrantyEndDate"
                type="date"
                defaultValue={editingAsset.warranty_end_date ?? ""}
                className={inputClassName}
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-300">Yeni Fotoğraf (Opsiyonel)</span>
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png"
                className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
              />
              {editingAsset.photo_path ? (
                <p className="mt-2 text-xs text-slate-400">Mevcut fotoğraf yolu: {editingAsset.photo_path}</p>
              ) : null}
            </label>

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
        <h2 className="text-xl font-semibold text-white">Varlık Listesi</h2>
        {isLoading ? (
          <p className="mt-4 text-sm text-slate-300">Yükleniyor...</p>
        ) : assets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-300">Henüz varlık eklenmedi.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300">
                  <th className="px-3 py-2">Ad</th>
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2">Marka / Model</th>
                  <th className="px-3 py-2">QR Kod</th>
                  <th className="px-3 py-2">Fotoğraf</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-white/10 text-slate-100">
                    <td className="px-3 py-3 font-medium">{asset.name}</td>
                    <td className="px-3 py-3">{asset.category}</td>
                    <td className="px-3 py-3">
                      {[asset.brand, asset.model].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{asset.qr_code ?? "-"}</td>
                    <td className="px-3 py-3">{asset.photo_path ? "Yüklü" : "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                        >
                          Detay
                        </Link>
                        <button
                          type="button"
                          onClick={() => onStartEdit(asset)}
                          className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/20"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset)}
                          className="rounded-full border border-red-300/35 bg-red-300/10 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-300/20"
                        >
                          Sil
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

      <AuditHistoryPanel
        title="Varlık Değişim Geçmişi"
        subtitle="Varlık kayıtlarindaki oluşturma, güncelleme ve silme hareketlerini izleyin."
        entityTypes={["assets"]}
        limit={15}
        refreshKey={auditRefreshKey}
        currentUserId={userId}
      />
    </AppShell>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}


