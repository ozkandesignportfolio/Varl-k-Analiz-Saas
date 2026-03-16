import { parseAssetQrPayload } from "@/lib/assets/qr-payload";

export type AssetMediaSelection = {
  images: File[];
  video: File | null;
  audio: File | null;
};

export type AssetFormDefaults = {
  name: string;
  category: string;
  serialNumber: string;
  brand: string;
  model: string;
  purchasePrice: string;
  purchaseDate: string;
  warrantyEndDate: string;
};

export type EditExistingMediaItem = {
  id: string;
  type: "image" | "video" | "audio";
  label: string;
  storagePath: string;
};

export type AssetMediaRow = {
  id: string;
  type: "image" | "video" | "audio";
  storage_path: string;
  created_at: string;
};

export const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export const FALLBACK_CATEGORY_OPTIONS = ["Elektronik", "Mobilya", "Arac", "Ofis", "Diger"];

export const EMPTY_MEDIA_SELECTION: AssetMediaSelection = {
  images: [],
  video: null,
  audio: null,
};

export const EMPTY_DEFAULTS: AssetFormDefaults = {
  name: "",
  category: "Elektronik",
  serialNumber: "",
  brand: "",
  model: "",
  purchasePrice: "",
  purchaseDate: "",
  warrantyEndDate: "",
};

export const isMissingAssetMediaTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("asset_media") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
};

export const toPayloadFromForm = (formData: FormData) => ({
  name: String(formData.get("name") ?? "").trim(),
  category: String(formData.get("category") ?? "").trim(),
  serialNumber: String(formData.get("serialNumber") ?? "").trim(),
  brand: String(formData.get("brand") ?? "").trim(),
  model: String(formData.get("model") ?? "").trim(),
  purchase_price: String(formData.get("purchasePrice") ?? "").trim(),
  purchaseDate: String(formData.get("purchaseDate") ?? "").trim(),
  warrantyEndDate: String(formData.get("warrantyEndDate") ?? "").trim(),
});

export const summarizeMediaSelection = (selection: AssetMediaSelection) => {
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

export const normalizeLabel = (storagePath: string, type: EditExistingMediaItem["type"]) => {
  const name = storagePath.split("/").filter(Boolean).pop();
  return name ?? `${type} dosyasi`;
};

export const parseQrDefaults = (rawValue: string): AssetFormDefaults => {
  const fallbackName = rawValue.trim();
  if (!fallbackName) {
    return EMPTY_DEFAULTS;
  }

  const prefill = parseAssetQrPayload(rawValue);
  if (prefill) {
    return {
      ...EMPTY_DEFAULTS,
      name: prefill.name ?? fallbackName,
      category: prefill.category ?? EMPTY_DEFAULTS.category,
      serialNumber: prefill.serialNumber ?? "",
      brand: prefill.brand ?? "",
      model: prefill.model ?? "",
      purchaseDate: prefill.purchaseDate ?? "",
      warrantyEndDate: prefill.warrantyEndDate ?? "",
    };
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
