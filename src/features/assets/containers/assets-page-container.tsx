"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, QrCode } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuditHistoryPanel } from "@/components/audit-history-panel";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { QuotaExceededModal } from "@/components/ui/QuotaExceededModal";
import { usePlanContext } from "@/contexts/PlanContext";
import { AssetForm, type CreateAssetFormDefaults } from "@/features/assets/components/asset-form";
import { AssetQuickPreviewDrawer } from "@/features/assets/components/asset-quick-preview-drawer";
import { AssetQrPreviewModal } from "@/features/assets/components/asset-qr-preview-modal";
import { AssetsFilterBar } from "@/features/assets/components/assets-filter-bar";
import { AssetListTable } from "@/features/assets/components/asset-list-table";
import type {
  AssetActivityItem,
  AssetDashboardRow,
  AssetFilterMode,
  AssetSortMode,
  AssetViewMode,
  MaintenanceFilterMode,
  MaintenanceState,
  WarrantyFilterMode,
  WarrantyState,
} from "@/features/assets/components/assets-view-types";
import {
  ASSET_MEDIA_BUCKET,
  ASSET_MEDIA_LIMITS,
  ASSET_MEDIA_TOTAL_LIMIT_BYTES,
  ASSET_MEDIA_TOTAL_LIMIT_MESSAGE,
  getAssetMediaCountError,
  toMegabytesLabel,
  validateAssetMediaFile,
  type AssetMediaType,
} from "@/lib/assets/media-limits";
import { parseAssetQrPayload } from "@/lib/assets/qr-payload";
import { canPlanUsePremiumMedia } from "@/lib/plans/premium-media";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type AssetRow = {
  id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  photo_path: string | null;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceLogSummaryRow = {
  id: string;
  asset_id: string;
  service_type: string;
  service_date: string;
  cost: number | null;
};

type MaintenanceRuleSummaryRow = {
  asset_id: string;
  next_due_date: string;
  is_active: boolean;
};

type DocumentSummaryRow = {
  asset_id: string;
};

type AssetMediaListRow = {
  asset_id: string;
  type: string;
  storage_path: string;
};

type AssetMediaDraft = {
  images: File[];
  video: File | null;
  audio: File | null;
};

const LEGACY_PHOTO_BUCKET = "documents-private";
const PREMIUM_MEDIA_REQUIRED_MESSAGE = "Ek medya özelliği Premium planında aktif.";
const categoryOptions = ["Beyaz Eşya", "Isıtma", "Soğutma", "Elektronik", "Mutfak", "Diğer"];
const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const EMPTY_MEDIA_DRAFT: AssetMediaDraft = { images: [], video: null, audio: null };
const MS_IN_DAY = 1000 * 60 * 60 * 24;

const getDayStart = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const getDateDistanceInDays = (target: string | null) => {
  const targetStart = getDayStart(target);
  if (!targetStart) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((targetStart.getTime() - today.getTime()) / MS_IN_DAY);
};

const resolveWarrantyState = (warrantyEndDate: string | null): WarrantyState => {
  const distance = getDateDistanceInDays(warrantyEndDate);
  if (distance === null) return "active";
  if (distance < 0) return "expired";
  if (distance <= 45) return "expiring";
  return "active";
};

const resolveMaintenanceState = (nextMaintenanceDate: string | null): MaintenanceState => {
  const distance = getDateDistanceInDays(nextMaintenanceDate);
  if (distance === null) return "none";
  if (distance < 0) return "overdue";
  if (distance <= 14) return "upcoming";
  return "scheduled";
};

const resolveAssetState = (maintenanceState: MaintenanceState) =>
  maintenanceState === "overdue" ? "passive" : "active";

const calculateHealthScore = (
  warrantyState: WarrantyState,
  maintenanceState: MaintenanceState,
  documentCount: number,
) => {
  let score = 100;
  if (warrantyState === "expired") score -= 35;
  if (warrantyState === "expiring") score -= 15;
  if (maintenanceState === "overdue") score -= 35;
  if (maintenanceState === "upcoming") score -= 15;
  if (documentCount === 0) score -= 10;
  return Math.max(0, Math.min(100, score));
};

const toOptionalString = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const isMissingQrCodeError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("qr_code") &&
    (normalized.includes("does not exist") || normalized.includes("could not find the column"))
  );
};

const isMissingAssetMediaError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("asset_media") && normalized.includes("does not exist");
};

const hasAnyMedia = (draft: AssetMediaDraft) =>
  draft.images.length > 0 || Boolean(draft.video) || Boolean(draft.audio);

const getMediaDraftSize = (draft: AssetMediaDraft) =>
  draft.images.reduce((sum, file) => sum + file.size, 0) + (draft.video?.size ?? 0) + (draft.audio?.size ?? 0);

const asIsoDate = (value: string | null) => (value ? value.slice(0, 10) : null);

export function AssetsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const { plan, assetLimit, setAssetCount } = usePlanContext();
  const isPremiumMediaEnabled = canPlanUsePremiumMedia(plan);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [maintenanceDateByAsset, setMaintenanceDateByAsset] = useState<Record<string, string | null>>({});
  const [documentCountByAsset, setDocumentCountByAsset] = useState<Record<string, number>>({});
  const [serviceLogsByAsset, setServiceLogsByAsset] = useState<Record<string, AssetActivityItem[]>>({});
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [hasValidSession, setHasValidSession] = useState(true);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [createFormDefaults, setCreateFormDefaults] = useState<CreateAssetFormDefaults>({});
  const [createFormKey, setCreateFormKey] = useState(0);
  const [mediaDraft, setMediaDraft] = useState<AssetMediaDraft>(EMPTY_MEDIA_DRAFT);
  const [mediaErrorMessage, setMediaErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState<AssetFilterMode>("all");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilterMode>("all");
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilterMode>("all");
  const [sortMode, setSortMode] = useState<AssetSortMode>("updated");
  const [viewMode, setViewMode] = useState<AssetViewMode>("table");
  const [selectedPreviewAssetId, setSelectedPreviewAssetId] = useState<string | null>(null);
  const [qrPreviewAssetId, setQrPreviewAssetId] = useState<string | null>(null);

  const validateMediaDraft = useCallback((draft: AssetMediaDraft) => {
    if (draft.images.length > ASSET_MEDIA_LIMITS.image.maxFiles) {
      return getAssetMediaCountError("image");
    }

    for (const image of draft.images) {
      const validationError = validateAssetMediaFile(image, "image");
      if (validationError) return validationError.message;
    }

    if (draft.video) {
      const validationError = validateAssetMediaFile(draft.video, "video");
      if (validationError) return validationError.message;
    }

    if (draft.audio) {
      const validationError = validateAssetMediaFile(draft.audio, "audio");
      if (validationError) return validationError.message;
    }

    if (getMediaDraftSize(draft) > ASSET_MEDIA_TOTAL_LIMIT_BYTES) {
      return ASSET_MEDIA_TOTAL_LIMIT_MESSAGE;
    }

    return null;
  }, []);

  const fetchAssets = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await supabase
        .from("assets")
        .select(
          "id,name,category,serial_number,brand,model,purchase_date,warranty_end_date,photo_path,qr_code,created_at,updated_at",
        )
        .eq("user_id", currentUserId)
        .order("updated_at", { ascending: false });

      if (error && isMissingQrCodeError(error.message)) {
        const fallbackRes = await supabase
          .from("assets")
          .select("id,name,category,serial_number,brand,model,purchase_date,warranty_end_date,photo_path,created_at,updated_at")
          .eq("user_id", currentUserId)
          .order("updated_at", { ascending: false });

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

  const fetchAssetMetrics = useCallback(
    async (currentUserId: string, assetRows: AssetRow[]) => {
      if (assetRows.length === 0) {
        setMaintenanceDateByAsset({});
        setDocumentCountByAsset({});
        setServiceLogsByAsset({});
        return;
      }

      const assetIds = assetRows.map((asset) => asset.id);

      const [serviceRes, documentRes, maintenanceRes] = await Promise.all([
        supabase
          .from("service_logs")
          .select("id,asset_id,service_type,service_date,cost")
          .eq("user_id", currentUserId)
          .in("asset_id", assetIds)
          .order("service_date", { ascending: false }),
        supabase
          .from("documents")
          .select("asset_id")
          .eq("user_id", currentUserId)
          .in("asset_id", assetIds),
        supabase
          .from("maintenance_rules")
          .select("asset_id,next_due_date,is_active")
          .eq("user_id", currentUserId)
          .eq("is_active", true)
          .in("asset_id", assetIds)
          .order("next_due_date", { ascending: true }),
      ]);

      if (serviceRes.error) {
        setFeedback(serviceRes.error.message);
      } else {
        const grouped = new Map<string, AssetActivityItem[]>();
        for (const row of (serviceRes.data ?? []) as ServiceLogSummaryRow[]) {
          const list = grouped.get(row.asset_id) ?? [];
          list.push({
            id: row.id,
            serviceType: row.service_type,
            serviceDate: row.service_date,
            cost: Number(row.cost ?? 0),
          });
          grouped.set(row.asset_id, list);
        }

        const nextMap: Record<string, AssetActivityItem[]> = {};
        for (const [key, value] of grouped.entries()) {
          nextMap[key] = value;
        }
        setServiceLogsByAsset(nextMap);
      }

      if (documentRes.error) {
        setFeedback(documentRes.error.message);
      } else {
        const counts: Record<string, number> = {};
        for (const row of (documentRes.data ?? []) as DocumentSummaryRow[]) {
          counts[row.asset_id] = (counts[row.asset_id] ?? 0) + 1;
        }
        setDocumentCountByAsset(counts);
      }

      if (maintenanceRes.error) {
        setFeedback(maintenanceRes.error.message);
      } else {
        const dueMap: Record<string, string | null> = {};
        for (const row of (maintenanceRes.data ?? []) as MaintenanceRuleSummaryRow[]) {
          if (!row.is_active) continue;
          if (!dueMap[row.asset_id]) dueMap[row.asset_id] = row.next_due_date;
        }
        setMaintenanceDateByAsset(dueMap);
      }
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

  useEffect(() => {
    if (!userId) return;
    void fetchAssetMetrics(userId, assets);
  }, [assets, fetchAssetMetrics, userId]);

  useEffect(() => {
    setAssetCount(assets.length);
  }, [assets.length, setAssetCount]);

  useEffect(() => {
    const loadThumbnails = async () => {
      if (!userId || assets.length === 0) {
        setThumbnailUrls({});
        return;
      }

      const assetIds = assets.map((asset) => asset.id);
      const { data: mediaRows, error: mediaError } = await supabase
        .from("asset_media")
        .select("asset_id,type,storage_path")
        .eq("user_id", userId)
        .eq("type", "image")
        .in("asset_id", assetIds);

      if (mediaError && !isMissingAssetMediaError(mediaError.message)) {
        setFeedback(mediaError.message);
      }

      const thumbnailSource = new Map<string, { path: string; bucket: string }>();
      for (const row of (mediaRows ?? []) as AssetMediaListRow[]) {
        if (!thumbnailSource.has(row.asset_id)) {
          thumbnailSource.set(row.asset_id, { path: row.storage_path, bucket: ASSET_MEDIA_BUCKET });
        }
      }

      for (const asset of assets) {
        if (!thumbnailSource.has(asset.id) && asset.photo_path) {
          thumbnailSource.set(asset.id, { path: asset.photo_path, bucket: LEGACY_PHOTO_BUCKET });
        }
      }

      const signedEntries = await Promise.all(
        [...thumbnailSource.entries()].map(async ([assetId, source]) => {
          const signed = await supabase.storage.from(source.bucket).createSignedUrl(source.path, 60 * 5);
          if (signed.error || !signed.data?.signedUrl) return null;
          return [assetId, signed.data.signedUrl] as const;
        }),
      );

      const nextUrls: Record<string, string> = {};
      for (const entry of signedEntries) {
        if (!entry) continue;
        nextUrls[entry[0]] = entry[1];
      }
      setThumbnailUrls(nextUrls);
    };

    void loadThumbnails();
  }, [assets, supabase, userId]);

  const uploadAssetMedia = useCallback(
    async (assetId: string, draft: AssetMediaDraft) => {
      if (!hasAnyMedia(draft)) {
        return { ok: true as const, uploaded: false as const };
      }

      if (!isPremiumMediaEnabled) {
        return { ok: false as const, error: PREMIUM_MEDIA_REQUIRED_MESSAGE };
      }

      const formData = new FormData();
      formData.append("assetId", assetId);
      for (const image of draft.images) formData.append("images", image);
      if (draft.video) formData.append("video", draft.video);
      if (draft.audio) formData.append("audio", draft.audio);

      const uploadResponse = await fetch("/api/asset-media", { method: "POST", body: formData });
      const uploadPayload = (await uploadResponse.json().catch(() => null)) as
        | { error?: string; uploadedCount?: number }
        | null;

      if (!uploadResponse.ok) {
        return { ok: false as const, error: uploadPayload?.error ?? "Medya yüklenemedi." };
      }

      return { ok: true as const, uploaded: Number(uploadPayload?.uploadedCount ?? 0) > 0 };
    },
    [isPremiumMediaEnabled],
  );

  const resetCreateForm = () => {
    setCreateFormDefaults({});
    setCreateFormKey((prev) => prev + 1);
    setMediaDraft(EMPTY_MEDIA_DRAFT);
    setMediaErrorMessage("");
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
    const serialNumber = toOptionalString(formData.get("serialNumber"));
    const brand = toOptionalString(formData.get("brand"));
    const model = toOptionalString(formData.get("model"));
    const purchaseDate = toOptionalString(formData.get("purchaseDate"));
    const warrantyEndDate = toOptionalString(formData.get("warrantyEndDate"));

    if (!name || !category) {
      setFeedback("Varlık adı ve kategori zorunludur.");
      return;
    }

    const mediaValidationError = validateMediaDraft(mediaDraft);
    if (mediaValidationError) {
      setMediaErrorMessage(mediaValidationError);
      setFeedback(mediaValidationError);
      return;
    }

    setIsSaving(true);

    try {
      const createResponse = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          serialNumber,
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
        const trialAssetLimit = assetLimit ?? 3;
        if (createResponse.status === 403 && plan === "free" && trialAssetLimit <= assets.length) {
          setIsQuotaModalOpen(true);
        }
        setFeedback(createPayload?.error ?? "Varlık kaydı oluşturulamadı.");
        return;
      }

      const mediaUploadResult = await uploadAssetMedia(createPayload.id, mediaDraft);

      if (!mediaUploadResult.ok) {
        setFeedback(`Varlık eklendi, ancak medya yüklenemedi: ${mediaUploadResult.error}`);
      } else if (mediaUploadResult.uploaded) {
        setFeedback("Varlık ve medya başarıyla eklendi.");
      } else {
        setFeedback("Varlık başarıyla eklendi.");
      }

      form.reset();
      resetCreateForm();
      await fetchAssets(userId);
      setAuditRefreshKey((prev) => prev + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Varlık kaydı oluşturulamadı.");
    } finally {
      setIsSaving(false);
    }
  };

  const onStartEdit = (asset: AssetDashboardRow) => {
    setEditingAsset({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      serial_number: asset.serial_number,
      brand: asset.brand,
      model: asset.model,
      purchase_date: asset.purchase_date,
      warranty_end_date: asset.warranty_end_date,
      photo_path: asset.photo_path,
      qr_code: asset.qr_code,
      created_at: asset.created_at,
      updated_at: asset.updated_at,
    });
    setFeedback("");
  };

  const onCancelEdit = () => {
    setEditingAsset(null);
  };

  const onUpdateAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAsset) return;
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const serialNumber = toOptionalString(formData.get("serialNumber"));
    const brand = toOptionalString(formData.get("brand"));
    const model = toOptionalString(formData.get("model"));
    const purchaseDate = toOptionalString(formData.get("purchaseDate"));
    const warrantyEndDate = toOptionalString(formData.get("warrantyEndDate"));

    if (!name || !category) {
      setFeedback("Varlık adı ve kategori zorunludur.");
      return;
    }

    setFeedback("");
    setIsUpdating(true);

    try {
      const updateResponse = await fetch("/api/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingAsset.id,
          name,
          category,
          serialNumber,
          brand,
          model,
          purchaseDate,
          warrantyEndDate,
        }),
      });

      const updatePayload = (await updateResponse.json().catch(() => null)) as { error?: string } | null;

      if (!updateResponse.ok) {
        setFeedback(updatePayload?.error ?? "Varlık güncellenemedi.");
        return;
      }

      setFeedback("Varlık güncellendi.");
      setEditingAsset(null);
      await fetchAssets(userId);
      setAuditRefreshKey((prev) => prev + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Varlık güncellenemedi.");
    } finally {
      setIsUpdating(false);
    }
  };

  const onDeleteAsset = async (asset: AssetDashboardRow) => {
    if (!userId) {
      setFeedback("Kullanıcı bilgisi yüklenemedi.");
      return;
    }

    const { data: mediaRows } = await supabase
      .from("asset_media")
      .select("storage_path")
      .eq("asset_id", asset.id)
      .eq("user_id", userId);
    const mediaStoragePaths = (mediaRows ?? [])
      .map((row: { storage_path: string }) => row.storage_path)
      .filter(Boolean);

    const deleteResponse = await fetch("/api/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: asset.id }),
    });
    const deletePayload = (await deleteResponse.json().catch(() => null)) as { error?: string } | null;

    if (!deleteResponse.ok) {
      setFeedback(deletePayload?.error ?? "Varlık silinemedi.");
      return;
    }

    if (mediaStoragePaths.length > 0) {
      await supabase.storage.from(ASSET_MEDIA_BUCKET).remove(mediaStoragePaths);
    }
    if (asset.photo_path) {
      await supabase.storage.from(LEGACY_PHOTO_BUCKET).remove([asset.photo_path]);
    }

    setAssets((prev) => prev.filter((item) => item.id !== asset.id));
    if (editingAsset?.id === asset.id) setEditingAsset(null);
    if (selectedPreviewAssetId === asset.id) setSelectedPreviewAssetId(null);
    if (qrPreviewAssetId === asset.id) setQrPreviewAssetId(null);
    setAuditRefreshKey((prev) => prev + 1);
  };

  const onQrDetected = async (rawCode: string) => {
    const parsed = parseAssetQrPayload(rawCode);
    if (!parsed) {
      setFeedback("QR içeriği desteklenmiyor. assetcare://asset?... veya JSON formatı kullanın.");
      return;
    }

    const resolvedCategory =
      parsed.category && categoryOptions.includes(parsed.category) ? parsed.category : parsed.category ?? "";

    setCreateFormDefaults({
      name: parsed.name ?? "",
      category: resolvedCategory,
      serialNumber: parsed.serialNumber ?? "",
      brand: parsed.brand ?? "",
      model: parsed.model ?? "",
      purchaseDate: parsed.purchaseDate ?? "",
      warrantyEndDate: parsed.warrantyEndDate ?? "",
    });
    setCreateFormKey((prev) => prev + 1);
    setMediaDraft(EMPTY_MEDIA_DRAFT);
    setMediaErrorMessage("");
    setFeedback("QR verisi forma aktarıldı. Kaydetmeden önce alanları düzenleyebilirsiniz.");

    queueMicrotask(() => {
      const createForm = document.getElementById("asset-create-form");
      createForm?.scrollIntoView({ behavior: "smooth", block: "start" });
      createForm?.querySelector<HTMLInputElement>("input[name='name']")?.focus();
    });
  };

  const onMediaSelection = (type: AssetMediaType, files: FileList | null, input: HTMLInputElement) => {
    if (!isPremiumMediaEnabled) {
      input.value = "";
      setMediaErrorMessage(PREMIUM_MEDIA_REQUIRED_MESSAGE);
      setFeedback(PREMIUM_MEDIA_REQUIRED_MESSAGE);
      return;
    }

    const selectedFiles = [...(files ?? [])];
    const nextDraft: AssetMediaDraft = {
      images: mediaDraft.images,
      video: mediaDraft.video,
      audio: mediaDraft.audio,
    };

    if (type === "image") {
      if (selectedFiles.length > ASSET_MEDIA_LIMITS.image.maxFiles) {
        input.value = "";
        setMediaErrorMessage(getAssetMediaCountError("image"));
        return;
      }
      nextDraft.images = selectedFiles;
    }

    if (type === "video") {
      if (selectedFiles.length > ASSET_MEDIA_LIMITS.video.maxFiles) {
        input.value = "";
        setMediaErrorMessage(getAssetMediaCountError("video"));
        return;
      }
      nextDraft.video = selectedFiles[0] ?? null;
    }

    if (type === "audio") {
      if (selectedFiles.length > ASSET_MEDIA_LIMITS.audio.maxFiles) {
        input.value = "";
        setMediaErrorMessage(getAssetMediaCountError("audio"));
        return;
      }
      nextDraft.audio = selectedFiles[0] ?? null;
    }

    const validationError = validateMediaDraft(nextDraft);
    if (validationError) {
      input.value = "";
      setMediaErrorMessage(validationError);
      return;
    }

    setMediaErrorMessage("");
    setMediaDraft(nextDraft);
  };

  const dashboardRows = useMemo<AssetDashboardRow[]>(() => {
    return assets.map((asset) => {
      const serviceLogs = serviceLogsByAsset[asset.id] ?? [];
      const lastServiceDate = serviceLogs.length > 0 ? serviceLogs[0].serviceDate : null;
      const totalCost = serviceLogs.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
      const documentCount = documentCountByAsset[asset.id] ?? 0;
      const nextMaintenanceDate = maintenanceDateByAsset[asset.id] ?? null;
      const warrantyState = resolveWarrantyState(asIsoDate(asset.warranty_end_date));
      const maintenanceState = resolveMaintenanceState(asIsoDate(nextMaintenanceDate));
      const assetState = resolveAssetState(maintenanceState);
      const score = calculateHealthScore(warrantyState, maintenanceState, documentCount);

      return {
        ...asset,
        warrantyState,
        maintenanceState,
        assetState,
        nextMaintenanceDate: asIsoDate(nextMaintenanceDate),
        lastServiceDate: asIsoDate(lastServiceDate),
        documentCount,
        totalCost,
        score,
      };
    });
  }, [assets, documentCountByAsset, maintenanceDateByAsset, serviceLogsByAsset]);

  const categories = useMemo(() => {
    return [...new Set(dashboardRows.map((asset) => asset.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [dashboardRows]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("tr-TR");
    const rows = dashboardRows.filter((asset) => {
      if (
        normalizedSearch &&
        !asset.name.toLocaleLowerCase("tr-TR").includes(normalizedSearch) &&
        !(asset.serial_number ?? "").toLocaleLowerCase("tr-TR").includes(normalizedSearch)
      ) {
        return false;
      }

      if (categoryFilter !== "all" && asset.category !== categoryFilter) return false;
      if (assetFilter !== "all" && asset.assetState !== assetFilter) return false;
      if (warrantyFilter !== "all" && asset.warrantyState !== warrantyFilter) return false;
      if (maintenanceFilter === "upcoming" && asset.maintenanceState !== "upcoming") return false;
      if (maintenanceFilter === "overdue" && asset.maintenanceState !== "overdue") return false;

      return true;
    });

    rows.sort((left, right) => {
      if (sortMode === "cost") return right.totalCost - left.totalCost;
      if (sortMode === "score") return right.score - left.score;
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

    return rows;
  }, [
    assetFilter,
    categoryFilter,
    dashboardRows,
    maintenanceFilter,
    searchTerm,
    sortMode,
    warrantyFilter,
  ]);

  const selectedPreviewAsset = useMemo(() => {
    if (!selectedPreviewAssetId) return null;
    return dashboardRows.find((asset) => asset.id === selectedPreviewAssetId) ?? null;
  }, [dashboardRows, selectedPreviewAssetId]);

  const selectedPreviewActivities = useMemo(() => {
    if (!selectedPreviewAssetId) return [];
    return (serviceLogsByAsset[selectedPreviewAssetId] ?? []).slice(0, 3);
  }, [selectedPreviewAssetId, serviceLogsByAsset]);

  const qrPreviewAsset = useMemo(() => {
    if (!qrPreviewAssetId) return null;
    return dashboardRows.find((asset) => asset.id === qrPreviewAssetId) ?? null;
  }, [dashboardRows, qrPreviewAssetId]);

  useEffect(() => {
    if (selectedPreviewAssetId && !dashboardRows.some((asset) => asset.id === selectedPreviewAssetId)) {
      setSelectedPreviewAssetId(null);
    }
  }, [dashboardRows, selectedPreviewAssetId]);

  const mediaSummary = useMemo(
    () => ({
      imageCount: mediaDraft.images.length,
      videoFileName: mediaDraft.video?.name ?? null,
      audioFileName: mediaDraft.audio?.name ?? null,
      totalSizeLabel: toMegabytesLabel(getMediaDraftSize(mediaDraft)),
    }),
    [mediaDraft],
  );

  const focusCreateAssetForm = useCallback(() => {
    const createForm = document.getElementById("asset-create-form");
    if (!createForm) return;
    createForm.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.querySelector<HTMLInputElement>("input[name='name']")?.focus();
  }, []);

  const summary = useMemo(() => {
    const overdueCount = dashboardRows.filter((asset) => asset.maintenanceState === "overdue").length;
    const upcomingCount = dashboardRows.filter((asset) => asset.maintenanceState === "upcoming").length;
    const expiringWarrantyCount = dashboardRows.filter((asset) => asset.warrantyState !== "active").length;
    const avgScore =
      dashboardRows.length === 0
        ? 0
        : Math.round(dashboardRows.reduce((sum, asset) => sum + asset.score, 0) / dashboardRows.length);

    return { overdueCount, upcomingCount, expiringWarrantyCount, avgScore };
  }, [dashboardRows]);

  if (!hasValidSession) return null;

  return (
    <AppShell
      badge="Varlık Yönetimi"
      title="Varlıklar"
      subtitle="Tüm varlıklarınızı tek yerden yönetin."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={focusCreateAssetForm}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Varlık Ekle
          </button>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/35 bg-fuchsia-300/10 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-300/20"
          >
            <QrCode className="h-4 w-4" />
            QR ile Ekle
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 opacity-70"
          >
            <Download className="h-4 w-4" />
            Dışa Aktar
          </button>
        </div>
      }
    >
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(value) => {
          void onQrDetected(value);
        }}
      />

      <AssetQrPreviewModal
        asset={qrPreviewAsset}
        isOpen={Boolean(qrPreviewAsset)}
        onClose={() => setQrPreviewAssetId(null)}
      />

      <AssetQuickPreviewDrawer
        asset={selectedPreviewAsset}
        activities={selectedPreviewActivities}
        onClose={() => setSelectedPreviewAssetId(null)}
      />

      <QuotaExceededModal
        open={isQuotaModalOpen}
        onOpenChange={setIsQuotaModalOpen}
        assetLimit={assetLimit ?? 3}
        assets={assets.slice(0, assetLimit ?? 3).map((asset) => ({ id: asset.id, name: asset.name, category: asset.category }))}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Toplam Varlık" value={String(dashboardRows.length)} />
        <SummaryItem label="Yaklaşan Bakım" value={String(summary.upcomingCount)} />
        <SummaryItem label="Riskli Garanti" value={String(summary.expiringWarrantyCount)} />
        <SummaryItem label="Ortalama Skor" value={`${summary.avgScore}`} accent={summary.overdueCount > 0 ? "warn" : "ok"} />
      </section>

      <AssetsFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        assetFilter={assetFilter}
        onAssetFilterChange={setAssetFilter}
        warrantyFilter={warrantyFilter}
        onWarrantyFilterChange={setWarrantyFilter}
        maintenanceFilter={maintenanceFilter}
        onMaintenanceFilterChange={setMaintenanceFilter}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categories={categories}
      />

      <AssetListTable
        isLoading={isLoading}
        viewMode={viewMode}
        assets={filteredAssets}
        thumbnailUrls={thumbnailUrls}
        onSelectAsset={(asset) => setSelectedPreviewAssetId(asset.id)}
        onStartEdit={onStartEdit}
        onShowQr={(asset) => setQrPreviewAssetId(asset.id)}
        onDeleteAsset={onDeleteAsset}
        onFocusCreateAsset={focusCreateAssetForm}
      />

      <section id="asset-create-form" className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <AssetForm
          key={createFormKey}
          mode="create"
          defaults={createFormDefaults}
          onSubmit={onCreateAsset}
          isSubmitting={isSaving}
          categoryOptions={categoryOptions}
          inputClassName={inputClassName}
          isPremiumMediaEnabled={isPremiumMediaEnabled}
          mediaErrorMessage={mediaErrorMessage}
          mediaSummary={mediaSummary}
          onMediaSelection={onMediaSelection}
        />

        <article className="premium-card p-5">
          <h2 className="text-lg font-semibold text-white">Premium Medya Limitleri</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            <li>Fotoğraf: 5 adet, dosya başına 3 MB</li>
            <li>Video: 1 adet, dosya başına 20 MB</li>
            <li>Ses: 1 adet, dosya başına 10 MB</li>
            <li>Toplam: 30 MB</li>
          </ul>
          {!isPremiumMediaEnabled ? (
            <div className="mt-4 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3">
              <p className="text-sm font-semibold text-amber-100">Ek Medya (Premium) kilitli</p>
              <p className="mt-1 text-xs text-amber-100/90">
                Trial planda yalnızca temel varlık alanları açıktır. Medya yükleme için Premium&apos;a geçebilirsiniz.
              </p>
              <button
                type="button"
                onClick={() => router.push("/pricing")}
                className="mt-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-xs font-semibold text-slate-950"
              >
                Premium&apos;a geç
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3">
              <p className="text-sm font-semibold text-emerald-100">Premium aktif</p>
              <p className="mt-1 text-xs text-emerald-100/90">Upload altyapısı hazır. Medya yönetimi adım adım genişletilecek.</p>
            </div>
          )}
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

      <AuditHistoryPanel
        title="Varlık Değişim Geçmişi"
        subtitle="Varlık kayıtlarındaki oluşturma, güncelleme ve silme hareketlerini izleyin."
        entityTypes={["assets"]}
        limit={15}
        refreshKey={auditRefreshKey}
        currentUserId={userId}
      />
    </AppShell>
  );
}

function SummaryItem({
  label,
  value,
  accent = "ok",
}: {
  label: string;
  value: string;
  accent?: "ok" | "warn";
}) {
  return (
    <article className="premium-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${accent === "warn" ? "text-amber-200" : "text-white"}`}>{value}</p>
    </article>
  );
}

