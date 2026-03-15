import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetActivityItem, AssetDashboardRow } from "@/features/assets/components/assets-view-types";
import type { UserPlan } from "@/contexts/PlanContext";
import type { ListAssetsRow } from "@/lib/repos/assets-repo";
import type { AssetsListQueryOptions } from "@/features/assets/hooks/useAssetsFilters";
import { ASSET_MEDIA_BUCKET } from "@/lib/assets/media-limits";

type AssetMediaSelection = {
  images: File[];
  video: File | null;
  audio: File | null;
};

type AssetFormDefaults = {
  name: string;
  category: string;
  serialNumber: string;
  brand: string;
  model: string;
  purchasePrice: string;
  purchaseDate: string;
  warrantyEndDate: string;
};

type EditExistingMediaItem = {
  id: string;
  type: "image" | "video" | "audio";
  label: string;
  storagePath: string;
};

type UseAssetsActionsArgs = {
  supabase: SupabaseClient;
  userId: string;
  plan: UserPlan;
  assetLimit: number | null;
  totalAssetCount: number;
  isPremiumMediaEnabled: boolean;
  listQueryOptions: AssetsListQueryOptions;
  refreshAssetCount: (currentUserId: string) => Promise<void>;
  fetchCategoryOptions: (currentUserId: string) => Promise<void>;
  fetchAssetsPage: (
    currentUserId: string,
    options?: { append?: boolean; cursor?: null } & AssetsListQueryOptions,
  ) => Promise<void>;
  setAssets: Dispatch<SetStateAction<ListAssetsRow[]>>;
  setThumbnailUrls: Dispatch<SetStateAction<Record<string, string>>>;
  setServiceActivityPreviewByAsset: Dispatch<SetStateAction<Record<string, AssetActivityItem[]>>>;
  setFeedback: Dispatch<SetStateAction<string>>;
  selectedPreviewAssetId: string | null;
  setSelectedPreviewAssetId: Dispatch<SetStateAction<string | null>>;
  qrPreviewAssetId: string | null;
  setQrPreviewAssetId: Dispatch<SetStateAction<string | null>>;
  onAuditRefresh: () => void;
};

type AssetMediaRow = {
  id: string;
  type: "image" | "video" | "audio";
  storage_path: string;
  created_at: string;
};

const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

const FALLBACK_CATEGORY_OPTIONS = ["Elektronik", "Mobilya", "Arac", "Ofis", "Diger"];

const EMPTY_MEDIA_SELECTION: AssetMediaSelection = {
  images: [],
  video: null,
  audio: null,
};

const EMPTY_DEFAULTS: AssetFormDefaults = {
  name: "",
  category: "Elektronik",
  serialNumber: "",
  brand: "",
  model: "",
  purchasePrice: "",
  purchaseDate: "",
  warrantyEndDate: "",
};

const isMissingAssetMediaTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("asset_media") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
};

const toPayloadFromForm = (formData: FormData) => ({
  name: String(formData.get("name") ?? "").trim(),
  category: String(formData.get("category") ?? "").trim(),
  serialNumber: String(formData.get("serialNumber") ?? "").trim(),
  brand: String(formData.get("brand") ?? "").trim(),
  model: String(formData.get("model") ?? "").trim(),
  purchase_price: String(formData.get("purchasePrice") ?? "").trim(),
  purchaseDate: String(formData.get("purchaseDate") ?? "").trim(),
  warrantyEndDate: String(formData.get("warrantyEndDate") ?? "").trim(),
});

const summarizeMediaSelection = (selection: AssetMediaSelection) => {
  const parts: string[] = [];
  if (selection.images.length > 0) {
    parts.push(`${selection.images.length} gorsel`);
  }
  if (selection.video) {
    parts.push("1 video");
  }
  if (selection.audio) {
    parts.push("1 ses");
  }
  return parts.length > 0 ? `${parts.join(", ")} secildi.` : "";
};

const normalizeLabel = (storagePath: string, type: EditExistingMediaItem["type"]) => {
  const name = storagePath.split("/").filter(Boolean).pop();
  return name ?? `${type} dosyasi`;
};

const parseQrDefaults = (rawValue: string): AssetFormDefaults => {
  const fallbackName = rawValue.trim();
  if (!fallbackName) {
    return EMPTY_DEFAULTS;
  }

  try {
    const url = new URL(rawValue);
    const getValue = (...keys: string[]) => {
      for (const key of keys) {
        const value = url.searchParams.get(key)?.trim();
        if (value) {
          return value;
        }
      }
      return "";
    };

    const name = getValue("name", "assetName");
    const category = getValue("category");
    const serialNumber = getValue("serialNumber", "serial", "serial_no");
    const brand = getValue("brand");
    const model = getValue("model");

    if (!name && !category && !serialNumber && !brand && !model) {
      return {
        ...EMPTY_DEFAULTS,
        name: fallbackName,
      };
    }

    return {
      ...EMPTY_DEFAULTS,
      name: name || fallbackName,
      category: category || EMPTY_DEFAULTS.category,
      serialNumber,
      brand,
      model,
    };
  } catch {
    return {
      ...EMPTY_DEFAULTS,
      name: fallbackName,
    };
  }
};

export function useAssetsActions({
  supabase,
  userId,
  plan,
  assetLimit,
  totalAssetCount,
  isPremiumMediaEnabled,
  listQueryOptions,
  refreshAssetCount,
  fetchCategoryOptions,
  fetchAssetsPage,
  setAssets,
  setThumbnailUrls,
  setServiceActivityPreviewByAsset,
  setFeedback,
  selectedPreviewAssetId,
  setSelectedPreviewAssetId,
  qrPreviewAssetId,
  setQrPreviewAssetId,
  onAuditRefresh,
}: UseAssetsActionsArgs) {
  void plan;
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetDashboardRow | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [createFormDefaults, setCreateFormDefaults] = useState<AssetFormDefaults>(EMPTY_DEFAULTS);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [createMediaSelection, setCreateMediaSelection] = useState<AssetMediaSelection>(EMPTY_MEDIA_SELECTION);
  const [editMediaSelection, setEditMediaSelection] = useState<AssetMediaSelection>(EMPTY_MEDIA_SELECTION);
  const [mediaErrorMessage, setMediaErrorMessage] = useState("");
  const [editMediaErrorMessage, setEditMediaErrorMessage] = useState("");
  const [editExistingMedia, setEditExistingMedia] = useState<EditExistingMediaItem[]>([]);
  const [isEditMediaLoading, setIsEditMediaLoading] = useState(false);
  const [removingEditMediaId, setRemovingEditMediaId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => FALLBACK_CATEGORY_OPTIONS, []);
  const mediaSummary = useMemo(() => summarizeMediaSelection(createMediaSelection), [createMediaSelection]);
  const editMediaSummary = useMemo(() => summarizeMediaSelection(editMediaSelection), [editMediaSelection]);

  const refreshAssetsView = useCallback(async () => {
    if (!userId) {
      return;
    }

    await Promise.all([
      fetchAssetsPage(userId, {
        append: false,
        cursor: null,
        ...listQueryOptions,
      }),
      refreshAssetCount(userId),
      fetchCategoryOptions(userId),
    ]);
  }, [fetchAssetsPage, fetchCategoryOptions, listQueryOptions, refreshAssetCount, userId]);

  const uploadMediaForAsset = useCallback(
    async (assetId: string, selection: AssetMediaSelection) => {
      if (!isPremiumMediaEnabled) {
        return null;
      }

      if (selection.images.length === 0 && !selection.video && !selection.audio) {
        return null;
      }

      const formData = new FormData();
      formData.append("assetId", assetId);
      for (const image of selection.images) {
        formData.append("images", image);
      }
      if (selection.video) {
        formData.append("video", selection.video);
      }
      if (selection.audio) {
        formData.append("audio", selection.audio);
      }

      const response = await fetch("/api/asset-media", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        return payload?.error ?? "Medya yukleme tamamlanamadi.";
      }

      return null;
    },
    [isPremiumMediaEnabled],
  );

  const loadEditExistingMedia = useCallback(
    async (assetId: string) => {
      if (!isPremiumMediaEnabled || !userId) {
        setEditExistingMedia([]);
        return;
      }

      setIsEditMediaLoading(true);
      try {
        const { data, error } = await supabase
          .from("asset_media")
          .select("id,type,storage_path,created_at")
          .eq("asset_id", assetId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          if (!isMissingAssetMediaTableError(error.message)) {
            setEditMediaErrorMessage(error.message);
          }
          setEditExistingMedia([]);
          return;
        }

        const rows = ((data ?? []) as AssetMediaRow[]).map((item) => ({
          id: item.id,
          type: item.type,
          label: normalizeLabel(item.storage_path, item.type),
          storagePath: item.storage_path,
        }));
        setEditExistingMedia(rows);
      } finally {
        setIsEditMediaLoading(false);
      }
    },
    [isPremiumMediaEnabled, supabase, userId],
  );

  const onCreateAsset = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFeedback("");
      setMediaErrorMessage("");

      if (!userId) {
        setFeedback("Oturum bulunamadi. Lutfen tekrar giris yapin.");
        return;
      }

      if (assetLimit !== null && totalAssetCount >= assetLimit) {
        setIsQuotaModalOpen(true);
        setFeedback("Varlik limiti doldu. Yeni kayit icin planinizi yukseltin.");
        return;
      }

      const payload = toPayloadFromForm(new FormData(event.currentTarget));
      if (!payload.name || !payload.category) {
        setFeedback("Varlik adi ve kategori zorunludur.");
        return;
      }

      setIsSaving(true);
      try {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (!response.ok || !body?.id) {
          const errorMessage = body?.error ?? "Varlik kaydi olusturulamadi.";
          if (response.status === 403) {
            setIsQuotaModalOpen(true);
          }
          setFeedback(errorMessage);
          return;
        }

        const uploadError = await uploadMediaForAsset(body.id, createMediaSelection);
        if (uploadError) {
          setMediaErrorMessage(uploadError);
        }

        setCreateFormDefaults(EMPTY_DEFAULTS);
        setCreateFormKey((current) => current + 1);
        setCreateMediaSelection(EMPTY_MEDIA_SELECTION);
        await refreshAssetsView();
        onAuditRefresh();
        setFeedback(`${payload.name} eklendi.`);
      } catch {
        setFeedback("Varlik kaydi olusturulamadi.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      assetLimit,
      createMediaSelection,
      onAuditRefresh,
      refreshAssetsView,
      setFeedback,
      totalAssetCount,
      uploadMediaForAsset,
      userId,
    ],
  );

  const onStartEdit = useCallback(
    (asset: AssetDashboardRow) => {
      setEditingAsset(asset);
      setEditMediaSelection(EMPTY_MEDIA_SELECTION);
      setEditMediaErrorMessage("");
      void loadEditExistingMedia(asset.id);
    },
    [loadEditExistingMedia],
  );

  const onCancelEdit = useCallback(() => {
    setEditingAsset(null);
    setEditMediaSelection(EMPTY_MEDIA_SELECTION);
    setEditMediaErrorMessage("");
    setEditExistingMedia([]);
  }, []);

  const onUpdateAsset = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFeedback("");
      setEditMediaErrorMessage("");

      if (!editingAsset) {
        return;
      }

      const payload = toPayloadFromForm(new FormData(event.currentTarget));
      if (!payload.name || !payload.category) {
        setFeedback("Varlik adi ve kategori zorunludur.");
        return;
      }

      setIsUpdating(true);
      try {
        const response = await fetch("/api/assets", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingAsset.id,
            ...payload,
          }),
        });

        const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
        if (!response.ok || !body?.id) {
          setFeedback(body?.error ?? "Varlik kaydi guncellenemedi.");
          return;
        }

        const uploadError = await uploadMediaForAsset(editingAsset.id, editMediaSelection);
        if (uploadError) {
          setEditMediaErrorMessage(uploadError);
        }

        await refreshAssetsView();
        onAuditRefresh();
        setFeedback(`${payload.name} guncellendi.`);
        onCancelEdit();
      } catch {
        setFeedback("Varlik kaydi guncellenemedi.");
      } finally {
        setIsUpdating(false);
      }
    },
    [
      editMediaSelection,
      editingAsset,
      onAuditRefresh,
      onCancelEdit,
      refreshAssetsView,
      setFeedback,
      uploadMediaForAsset,
    ],
  );

  const onDeleteAsset = useCallback(
    async (asset: AssetDashboardRow) => {
      setFeedback("");
      try {
        const response = await fetch("/api/assets", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: asset.id }),
        });

        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          setFeedback(body?.error ?? "Varlik silinemedi.");
          return;
        }

        setAssets((current) => current.filter((item) => item.id !== asset.id));
        setThumbnailUrls((current) => {
          const next = { ...current };
          delete next[asset.id];
          return next;
        });
        setServiceActivityPreviewByAsset((current) => {
          const next = { ...current };
          delete next[asset.id];
          return next;
        });
        if (selectedPreviewAssetId === asset.id) {
          setSelectedPreviewAssetId(null);
        }
        if (qrPreviewAssetId === asset.id) {
          setQrPreviewAssetId(null);
        }

        await refreshAssetsView();
        onAuditRefresh();
        setFeedback(`${asset.name} silindi.`);
      } catch {
        setFeedback("Varlik silinemedi.");
      }
    },
    [
      onAuditRefresh,
      qrPreviewAssetId,
      refreshAssetsView,
      selectedPreviewAssetId,
      setAssets,
      setFeedback,
      setQrPreviewAssetId,
      setSelectedPreviewAssetId,
      setServiceActivityPreviewByAsset,
      setThumbnailUrls,
    ],
  );

  const onQrDetected = useCallback(
    async (value: string) => {
      const nextDefaults = parseQrDefaults(value);
      setCreateFormDefaults(nextDefaults);
      setCreateFormKey((current) => current + 1);
      setFeedback("QR verisi forma aktarildi.");
    },
    [setFeedback],
  );

  const onMediaSelection = useCallback((selection: AssetMediaSelection) => {
    setCreateMediaSelection(selection);
    setMediaErrorMessage("");
  }, []);

  const onEditMediaSelection = useCallback((selection: AssetMediaSelection) => {
    setEditMediaSelection(selection);
    setEditMediaErrorMessage("");
  }, []);

  const onRemoveExistingMedia = useCallback(
    async (mediaId: string) => {
      if (!userId) {
        return;
      }

      const item = editExistingMedia.find((entry) => entry.id === mediaId);
      if (!item) {
        return;
      }

      setRemovingEditMediaId(mediaId);
      setEditMediaErrorMessage("");
      try {
        const { error: deleteRowError } = await supabase
          .from("asset_media")
          .delete()
          .eq("id", mediaId)
          .eq("user_id", userId);

        if (deleteRowError) {
          setEditMediaErrorMessage(deleteRowError.message);
          return;
        }

        const { error: removeStorageError } = await supabase.storage
          .from(ASSET_MEDIA_BUCKET)
          .remove([item.storagePath]);

        if (removeStorageError) {
          setEditMediaErrorMessage(removeStorageError.message);
        }

        setEditExistingMedia((current) => current.filter((entry) => entry.id !== mediaId));
      } finally {
        setRemovingEditMediaId(null);
      }
    },
    [editExistingMedia, supabase, userId],
  );

  return {
    categoryOptions,
    inputClassName,
    isSaving,
    isUpdating,
    editingAsset,
    isScannerOpen,
    setIsScannerOpen,
    isQuotaModalOpen,
    setIsQuotaModalOpen,
    createFormDefaults,
    createFormKey,
    mediaErrorMessage,
    editMediaErrorMessage,
    editExistingMedia,
    isEditMediaLoading,
    removingEditMediaId,
    mediaSummary,
    editMediaSummary,
    onCreateAsset,
    onStartEdit,
    onCancelEdit,
    onUpdateAsset,
    onDeleteAsset,
    onQrDetected,
    onMediaSelection,
    onEditMediaSelection,
    onRemoveExistingMedia,
  };
}
