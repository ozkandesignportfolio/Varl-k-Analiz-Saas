"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, QrCode } from "lucide-react";
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
  WarrantyFilterMode,
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
import {
  countByUser as countAssetsByUser,
  listCategories as listAssetCategories,
  type AssetsCursor,
  type ListAssetsRow,
} from "@/lib/repos/assets-repo";
import { listAssetActivityPreview } from "@/lib/repos/service-logs-repo";
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
type ListAssetsPageResponse = {
  rows: ListAssetsRow[];
  nextCursor: AssetsCursor | null;
  hasMore: boolean;
};

const LEGACY_PHOTO_BUCKET = "documents-private";
const THUMBNAIL_BUCKET_FALLBACK_ORDER = [ASSET_MEDIA_BUCKET, LEGACY_PHOTO_BUCKET] as const;
const PREMIUM_MEDIA_REQUIRED_MESSAGE = "Ek medya özelliği Premium planında aktif.";
const categoryOptions = ["Beyaz Eşya", "Isıtma", "Soğutma", "Elektronik", "Mutfak", "Diğer"];
const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";
const EMPTY_MEDIA_DRAFT: AssetMediaDraft = { images: [], video: null, audio: null };
const ASSETS_PAGE_SIZE = 30;

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

  const [assets, setAssets] = useState<ListAssetsRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalAssetCount, setTotalAssetCount] = useState(0);
  const [assetsCursor, setAssetsCursor] = useState<AssetsCursor | null>(null);
  const [hasMoreAssets, setHasMoreAssets] = useState(false);
  const [isLoadingMoreAssets, setIsLoadingMoreAssets] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [serviceActivityPreviewByAsset, setServiceActivityPreviewByAsset] = useState<
    Record<string, AssetActivityItem[]>
  >({});
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
  const [editMediaDraft, setEditMediaDraft] = useState<AssetMediaDraft>(EMPTY_MEDIA_DRAFT);
  const [editMediaErrorMessage, setEditMediaErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState<AssetFilterMode>("all");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilterMode>("all");
  const [maintenanceFilter, setMaintenanceFilter] = useState<MaintenanceFilterMode>("all");
  const [sortMode, setSortMode] = useState<AssetSortMode>("updated");
  const [viewMode, setViewMode] = useState<AssetViewMode>("table");
  const [selectedPreviewAssetId, setSelectedPreviewAssetId] = useState<string | null>(null);
  const [qrPreviewAssetId, setQrPreviewAssetId] = useState<string | null>(null);

  const listQueryOptions = useMemo(
    () => ({
      search: searchTerm.trim() ? searchTerm : undefined,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      sort: sortMode,
      assetFilter: assetFilter === "all" ? undefined : assetFilter,
      warrantyFilter: warrantyFilter === "all" ? undefined : warrantyFilter,
      maintenanceFilter: maintenanceFilter === "all" ? undefined : maintenanceFilter,
    }),
    [assetFilter, categoryFilter, maintenanceFilter, searchTerm, sortMode, warrantyFilter],
  );

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

  const refreshAssetCount = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await countAssetsByUser(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      const count = data ?? 0;
      setTotalAssetCount(count);
      setAssetCount(count);
    },
    [setAssetCount, supabase],
  );

  const fetchCategoryOptions = useCallback(
    async (currentUserId: string) => {
      const { data, error } = await listAssetCategories(supabase, { userId: currentUserId });
      if (error) {
        setFeedback(error.message);
        return;
      }
      setCategories(data ?? []);
    },
    [supabase],
  );

  const fetchAssetActivityPreview = useCallback(
    async (currentUserId: string, assetRows: ListAssetsRow[], options?: { append?: boolean }) => {
      const append = options?.append === true;
      if (assetRows.length === 0) {
        if (!append) setServiceActivityPreviewByAsset({});
        return;
      }

      const assetIds = assetRows.map((asset) => asset.id);
      const { data, error } = await listAssetActivityPreview(supabase, {
        userId: currentUserId,
        assetIds,
        perAssetLimit: 3,
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      const grouped = new Map<string, AssetActivityItem[]>();
      for (const row of data ?? []) {
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

      setServiceActivityPreviewByAsset((prev) => (append ? { ...prev, ...nextMap } : nextMap));
    },
    [supabase],
  );

  const loadThumbnailsForAssets = useCallback(
    async (currentUserId: string, assetRows: ListAssetsRow[], options?: { append?: boolean }) => {
      const append = options?.append === true;
      if (assetRows.length === 0) {
        if (!append) setThumbnailUrls({});
        return;
      }

      const assetIds = assetRows.map((asset) => asset.id);
      const { data: mediaRows, error: mediaError } = await supabase
        .from("asset_media")
        .select("asset_id,type,storage_path")
        .eq("user_id", currentUserId)
        .eq("type", "image")
        .in("asset_id", assetIds);

      if (mediaError && !isMissingAssetMediaError(mediaError.message)) {
        setFeedback(mediaError.message);
      }

      const resolveSignedUrl = async (path: string, preferredBucket?: string) => {
        const candidateBuckets = preferredBucket
          ? [
              preferredBucket,
              ...THUMBNAIL_BUCKET_FALLBACK_ORDER.filter((bucket) => bucket !== preferredBucket),
            ]
          : [...THUMBNAIL_BUCKET_FALLBACK_ORDER];

        for (const bucket of candidateBuckets) {
          const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5);
          if (!signed.error && signed.data?.signedUrl) {
            return signed.data.signedUrl;
          }
        }

        return null;
      };

      const thumbnailSource = new Map<string, { path: string; preferredBucket?: string }>();
      for (const row of (mediaRows ?? []) as AssetMediaListRow[]) {
        if (!thumbnailSource.has(row.asset_id)) {
          thumbnailSource.set(row.asset_id, { path: row.storage_path, preferredBucket: ASSET_MEDIA_BUCKET });
        }
      }

      for (const asset of assetRows) {
        if (!thumbnailSource.has(asset.id) && asset.photo_path) {
          thumbnailSource.set(asset.id, { path: asset.photo_path });
        }
      }

      const signedEntries = await Promise.all(
        [...thumbnailSource.entries()].map(async ([assetId, source]) => {
          const signedUrl = await resolveSignedUrl(source.path, source.preferredBucket);
          if (!signedUrl) return null;
          return [assetId, signedUrl] as const;
        }),
      );

      const nextUrls: Record<string, string> = {};
      for (const entry of signedEntries) {
        if (!entry) continue;
        nextUrls[entry[0]] = entry[1];
      }

      setThumbnailUrls((prev) => (append ? { ...prev, ...nextUrls } : nextUrls));
    },
    [supabase],
  );

  const fetchAssetsPage = useCallback(
    async (
      currentUserId: string,
      options?: {
        append?: boolean;
        cursor?: AssetsCursor | null;
        search?: string;
        category?: string;
        sort?: AssetSortMode;
        assetFilter?: AssetFilterMode;
        warrantyFilter?: WarrantyFilterMode;
        maintenanceFilter?: MaintenanceFilterMode;
      },
    ) => {
      const append = options?.append === true;

      if (append) {
        setIsLoadingMoreAssets(true);
      } else {
        setIsLoading(true);
      }

      const query = new URLSearchParams();
      query.set("pageSize", String(ASSETS_PAGE_SIZE));
      query.set("sort", options?.sort ?? "updated");
      if (options?.search) query.set("search", options.search);
      if (options?.category) query.set("category", options.category);
      if (options?.assetFilter) query.set("assetFilter", options.assetFilter);
      if (options?.warrantyFilter) query.set("warrantyFilter", options.warrantyFilter);
      if (options?.maintenanceFilter) query.set("maintenanceFilter", options.maintenanceFilter);
      if (options?.cursor?.value) query.set("cursorValue", options.cursor.value);
      if (options?.cursor?.id) query.set("cursorId", options.cursor.id);
      if (options?.cursor?.sort) query.set("cursorSort", options.cursor.sort);

      const response = await fetch(`/api/assets?${query.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | (ListAssetsPageResponse & { error?: never })
        | { error?: string }
        | null;
      const errorMessage = response.ok ? null : (payload?.error ?? "Varliklar yuklenemedi.");

      if (errorMessage && isMissingQrCodeError(errorMessage)) {
        setFeedback("Veritabani surumu guncellemesi gerekiyor: qr_code kolonu eksik.");
        if (append) {
          setIsLoadingMoreAssets(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      if (errorMessage) {
        setFeedback(errorMessage);
        if (append) {
          setIsLoadingMoreAssets(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      const pageData: ListAssetsPageResponse =
        payload && "rows" in payload
          ? {
              rows: payload.rows ?? [],
              nextCursor: payload.nextCursor ?? null,
              hasMore: payload.hasMore ?? false,
            }
          : { rows: [], nextCursor: null, hasMore: false };
      const rows = (pageData.rows ?? []) as ListAssetsRow[];

      setHasMoreAssets(pageData.hasMore);
      setAssetsCursor(pageData.nextCursor);

      await Promise.all([
        fetchAssetActivityPreview(currentUserId, rows, { append }),
        loadThumbnailsForAssets(currentUserId, rows, { append }),
      ]);

      if (append) {
        setAssets((prev) => [...prev, ...rows]);
        setIsLoadingMoreAssets(false);
      } else {
        setAssets(rows);
        setIsLoading(false);
      }
    },
    [fetchAssetActivityPreview, loadThumbnailsForAssets],
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
      await Promise.all([refreshAssetCount(user.id), fetchCategoryOptions(user.id)]);
    };

    void load();
  }, [fetchCategoryOptions, refreshAssetCount, router, supabase]);

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
        if (createResponse.status === 403 && plan !== "premium" && trialAssetLimit <= totalAssetCount) {
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
      await Promise.all([
        refreshAssetCount(userId),
        fetchCategoryOptions(userId),
        fetchAssetsPage(userId, {
          append: false,
          cursor: null,
          ...listQueryOptions,
        }),
      ]);
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
    setSelectedPreviewAssetId(null);
    setQrPreviewAssetId(null);
    setEditMediaDraft(EMPTY_MEDIA_DRAFT);
    setEditMediaErrorMessage("");
    setFeedback("");
  };

  const onCancelEdit = () => {
    setEditingAsset(null);
    setEditMediaDraft(EMPTY_MEDIA_DRAFT);
    setEditMediaErrorMessage("");
  };

  useEffect(() => {
    if (!editingAsset) return;

    queueMicrotask(() => {
      const editCard = document.querySelector<HTMLElement>("[data-testid='asset-edit-card']");
      if (!editCard) return;
      editCard.scrollIntoView({ behavior: "smooth", block: "start" });
      editCard.querySelector<HTMLInputElement>("input[name='name']")?.focus();
    });
  }, [editingAsset]);

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

    const mediaValidationError = validateMediaDraft(editMediaDraft);
    if (mediaValidationError) {
      setEditMediaErrorMessage(mediaValidationError);
      setFeedback(mediaValidationError);
      return;
    }

    setEditMediaErrorMessage("");
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

      const mediaUploadResult = await uploadAssetMedia(editingAsset.id, editMediaDraft);

      if (!mediaUploadResult.ok) {
        setFeedback(`Varlık güncellendi, ancak medya yüklenemedi: ${mediaUploadResult.error}`);
      } else if (mediaUploadResult.uploaded) {
        setFeedback("Varlık ve medya güncellendi.");
      } else {
        setFeedback("Varlık güncellendi.");
      }

      setEditingAsset(null);
      setEditMediaDraft(EMPTY_MEDIA_DRAFT);
      setEditMediaErrorMessage("");
      await Promise.all([
        refreshAssetCount(userId),
        fetchCategoryOptions(userId),
        fetchAssetsPage(userId, {
          append: false,
          cursor: null,
          ...listQueryOptions,
        }),
      ]);
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
      await Promise.all([
        supabase.storage.from(ASSET_MEDIA_BUCKET).remove([asset.photo_path]),
        supabase.storage.from(LEGACY_PHOTO_BUCKET).remove([asset.photo_path]),
      ]);
    }

    setAssets((prev) => prev.filter((item) => item.id !== asset.id));
    setThumbnailUrls((prev) => {
      const next = { ...prev };
      delete next[asset.id];
      return next;
    });
    setServiceActivityPreviewByAsset((prev) => {
      const next = { ...prev };
      delete next[asset.id];
      return next;
    });
    await Promise.all([refreshAssetCount(userId), fetchCategoryOptions(userId)]);
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

  const onEditMediaSelection = (type: AssetMediaType, files: FileList | null, input: HTMLInputElement) => {
    if (!isPremiumMediaEnabled) {
      input.value = "";
      setEditMediaErrorMessage(PREMIUM_MEDIA_REQUIRED_MESSAGE);
      setFeedback(PREMIUM_MEDIA_REQUIRED_MESSAGE);
      return;
    }

    const selectedFiles = [...(files ?? [])];
    const nextDraft: AssetMediaDraft = {
      images: editMediaDraft.images,
      video: editMediaDraft.video,
      audio: editMediaDraft.audio,
    };

    if (type === "image") {
      if (selectedFiles.length > ASSET_MEDIA_LIMITS.image.maxFiles) {
        input.value = "";
        setEditMediaErrorMessage(getAssetMediaCountError("image"));
        return;
      }
      nextDraft.images = selectedFiles;
    }

    if (type === "video") {
      if (selectedFiles.length > ASSET_MEDIA_LIMITS.video.maxFiles) {
        input.value = "";
        setEditMediaErrorMessage(getAssetMediaCountError("video"));
        return;
      }
      nextDraft.video = selectedFiles[0] ?? null;
    }

    if (type === "audio") {
      if (selectedFiles.length > ASSET_MEDIA_LIMITS.audio.maxFiles) {
        input.value = "";
        setEditMediaErrorMessage(getAssetMediaCountError("audio"));
        return;
      }
      nextDraft.audio = selectedFiles[0] ?? null;
    }

    const validationError = validateMediaDraft(nextDraft);
    if (validationError) {
      input.value = "";
      setEditMediaErrorMessage(validationError);
      return;
    }

    setEditMediaErrorMessage("");
    setEditMediaDraft(nextDraft);
  };

  const dashboardRows = useMemo<AssetDashboardRow[]>(() => {
    return assets.map((asset) => {
      return {
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
        warrantyState: asset.warranty_state,
        maintenanceState: asset.maintenance_state,
        assetState: asset.asset_state,
        nextMaintenanceDate: asIsoDate(asset.next_maintenance_date),
        lastServiceDate: asIsoDate(asset.last_service_date),
        documentCount: Number(asset.document_count ?? 0),
        totalCost: Number(asset.total_cost ?? 0),
        score: Number(asset.score ?? 0),
      };
    });
  }, [assets]);

  const selectedPreviewAsset = useMemo(() => {
    if (!selectedPreviewAssetId) return null;
    return dashboardRows.find((asset) => asset.id === selectedPreviewAssetId) ?? null;
  }, [dashboardRows, selectedPreviewAssetId]);

  const selectedPreviewActivities = useMemo(() => {
    if (!selectedPreviewAssetId) return [];
    return serviceActivityPreviewByAsset[selectedPreviewAssetId] ?? [];
  }, [selectedPreviewAssetId, serviceActivityPreviewByAsset]);

  const qrPreviewAsset = useMemo(() => {
    if (!qrPreviewAssetId) return null;
    return dashboardRows.find((asset) => asset.id === qrPreviewAssetId) ?? null;
  }, [dashboardRows, qrPreviewAssetId]);

  useEffect(() => {
    if (selectedPreviewAssetId && !dashboardRows.some((asset) => asset.id === selectedPreviewAssetId)) {
      setSelectedPreviewAssetId(null);
    }
  }, [dashboardRows, selectedPreviewAssetId]);

  useEffect(() => {
    if (!userId) return;
    void fetchAssetsPage(userId, {
      append: false,
      cursor: null,
      ...listQueryOptions,
    });
  }, [fetchAssetsPage, listQueryOptions, userId]);

  const mediaSummary = useMemo(
    () => ({
      imageCount: mediaDraft.images.length,
      videoFileName: mediaDraft.video?.name ?? null,
      audioFileName: mediaDraft.audio?.name ?? null,
      totalSizeLabel: toMegabytesLabel(getMediaDraftSize(mediaDraft)),
    }),
    [mediaDraft],
  );

  const editMediaSummary = useMemo(
    () => ({
      imageCount: editMediaDraft.images.length,
      videoFileName: editMediaDraft.video?.name ?? null,
      audioFileName: editMediaDraft.audio?.name ?? null,
      totalSizeLabel: toMegabytesLabel(getMediaDraftSize(editMediaDraft)),
    }),
    [editMediaDraft],
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
        <div className="flex flex-wrap items-center gap-2" data-testid="assets-actions">
          <button
            type="button"
            onClick={focusCreateAssetForm}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white"
            data-testid="assets-add-button"
          >
            <Plus className="h-4 w-4" />
            Varlık Ekle
          </button>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/35 bg-fuchsia-300/10 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-300/20"
            data-testid="assets-qr-add-button"
          >
            <QrCode className="h-4 w-4" />
            QR ile Ekle
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="assets-summary">
        <SummaryItem label="Toplam Varlık" value={String(totalAssetCount)} />
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
        assets={dashboardRows}
        thumbnailUrls={thumbnailUrls}
        onSelectAsset={(asset) => setSelectedPreviewAssetId(asset.id)}
        onStartEdit={onStartEdit}
        onShowQr={(asset) => setQrPreviewAssetId(asset.id)}
        onDeleteAsset={onDeleteAsset}
        onFocusCreateAsset={focusCreateAssetForm}
      />

      {hasMoreAssets ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (!userId || !assetsCursor || isLoadingMoreAssets) return;
              void fetchAssetsPage(userId, {
                append: true,
                cursor: assetsCursor,
                ...listQueryOptions,
              });
            }}
            disabled={isLoadingMoreAssets}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreAssets ? "Yukleniyor..." : "Daha Fazla Varlik"}
          </button>
        </div>
      ) : null}

      <section id="asset-create-form" className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]" data-testid="assets-create-section">
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
                Trial planda yalnızca temel varlık alanları açıktır. Medya yükleme için Premium’a geçebilirsiniz.
              </p>
              <button
                type="button"
                onClick={() => router.push("/pricing")}
                className="mt-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-xs font-semibold text-slate-950"
              >
                Premium’a geç
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
          key={editingAsset.id}
          mode="edit"
          asset={editingAsset}
          onCancel={onCancelEdit}
          onSubmit={onUpdateAsset}
          isSubmitting={isUpdating}
          categoryOptions={categoryOptions}
          inputClassName={inputClassName}
          isPremiumMediaEnabled={isPremiumMediaEnabled}
          mediaErrorMessage={editMediaErrorMessage}
          mediaSummary={editMediaSummary}
          onMediaSelection={onEditMediaSelection}
        />
      ) : null}

      {feedback ? (
        <p
          className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100"
          data-testid="assets-feedback"
        >
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
