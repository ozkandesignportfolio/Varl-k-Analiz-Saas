"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { GuidedEmptyState } from "@/components/guided-empty-state";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { AssetForm } from "@/features/assets/components/asset-form";
import { AssetListTable } from "@/features/assets/components/asset-list-table";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

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

export function AssetsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const fetchAssets = useCallback(
    async (currentUserId: string) => {
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
      await fetchAssets(user.id);
      setIsLoading(false);
    };

    void load();
  }, [fetchAssets, router, supabase]);

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

  const ensureAuthUser = () => {
    if (!userId) throw new Error("auth required");
  };

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

    try {
      ensureAuthUser();
      const createResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          brand,
          model,
          purchaseDate,
          warrantyEndDate,
        }),
      });

      const createPayload = (await createResponse.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!createResponse.ok || !createPayload?.id) {
        setFeedback(createPayload?.error ?? "Varlık kaydı oluşturulamadı.");
        return;
      }

      const assetId = createPayload.id;

      if (photoFile instanceof File && photoFile.size > 0) {
        try {
          const storagePath = await uploadPhoto(assetId, photoFile);
          const updatePhotoResponse = await fetch("/api/assets", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: assetId, photoPath: storagePath }),
          });

          const updatePhotoPayload = (await updatePhotoResponse.json().catch(() => null)) as
            | { error?: string }
            | null;

          if (!updatePhotoResponse.ok) {
            setFeedback(
              `Varlık eklendi, ancak fotoğraf yolu kaydedilemedi: ${updatePhotoPayload?.error ?? "Bilinmeyen hata."}`,
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
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Varlık kaydı oluşturulamadı.");
    } finally {
      setIsSaving(false);
    }
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

    try {
      ensureAuthUser();
      const updateResponse = await fetch("/api/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAsset.id,
          name,
          category,
          brand,
          model,
          purchaseDate,
          warrantyEndDate,
          photoPath: nextPhotoPath,
        }),
      });

      const updatePayload = (await updateResponse.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!updateResponse.ok) {
        setFeedback(updatePayload?.error ?? "Varlık güncellenemedi.");
        setIsUpdating(false);
        return;
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Varlık güncellenemedi.");
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
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const deleteResponse = await fetch("/api/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asset.id }),
    });
    const deletePayload = (await deleteResponse.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!deleteResponse.ok) {
      setFeedback(deletePayload?.error ?? "Varlık silinemedi.");
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

  const focusCreateAssetForm = useCallback(() => {
    const createForm = document.getElementById("asset-create-form");
    if (!createForm) return;

    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLInputElement>("input[name='name']")?.focus();
  }, []);

  if (!hasValidSession) {
    return null;
  }

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
        <div id="asset-create-form">
          <AssetForm
            mode="create"
            onSubmit={onCreateAsset}
            isSubmitting={isSaving}
            categoryOptions={categoryOptions}
            inputClassName={inputClassName}
          />
        </div>

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
        <AssetForm
          mode="edit"
          asset={editingAsset}
          onCancel={onCancelEdit}
          onSubmit={onUpdateAsset}
          isSubmitting={isUpdating}
          categoryOptions={categoryOptions}
          inputClassName={inputClassName}
        />
      ) : null}

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      <AssetListTable
        isLoading={isLoading}
        assets={assets}
        onStartEdit={onStartEdit}
        onDeleteAsset={onDeleteAsset}
        emptyState={
          !isLoading ? (
            <GuidedEmptyState
              title="Ilk varligini ekleyerek basla"
              description="Yeni hesaplarda demo kayitlar otomatik gelir. Kendi envanterinle devam etmek icin yeni bir varlik olustur."
              primaryAction={{ label: "Varlik formuna git", onClick: focusCreateAssetForm }}
              secondaryAction={{ label: "Ornek verileri gor", href: "/dashboard" }}
            />
          ) : undefined
        }
      />

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

