const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_ASSETCARE_QR_PREFIX = "assetcare://asset?";
const ASSETLY_QR_PREFIX = "assetly://asset?";

type OptionalText = string | null;

export type AssetQrPrefill = {
  assetId: OptionalText;
  name: OptionalText;
  category: OptionalText;
  serialNumber: OptionalText;
  brand: OptionalText;
  model: OptionalText;
  purchaseDate: OptionalText;
  warrantyEndDate: OptionalText;
};

export type AssetQrPayloadSource = {
  assetId: string;
  name: string;
  category: string;
  serialNumber?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type AssetQrPayloadRecord = AssetQrPayloadSource & {
  qrCode?: string | null;
};

const toOptionalText = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const toOptionalDate = (value: unknown) => {
  const trimmed = toOptionalText(value);
  if (!trimmed) {
    return null;
  }

  return DATE_PATTERN.test(trimmed) ? trimmed : null;
};

const readFromObject = (record: Record<string, unknown>): AssetQrPrefill => ({
  assetId: toOptionalText(record.asset_id ?? record.assetId ?? record.id),
  name: toOptionalText(record.name),
  category: toOptionalText(record.category),
  serialNumber: toOptionalText(record.serial ?? record.serialNumber ?? record.serial_number),
  brand: toOptionalText(record.brand),
  model: toOptionalText(record.model),
  purchaseDate: toOptionalDate(record.purchaseDate ?? record.purchase_date),
  warrantyEndDate: toOptionalDate(record.warrantyEndDate ?? record.warranty_end_date),
});

const hasMeaningfulPrefill = (value: AssetQrPrefill) =>
  Boolean(
    value.assetId ||
      value.name ||
      value.category ||
      value.serialNumber ||
      value.brand ||
      value.model ||
      value.purchaseDate ||
      value.warrantyEndDate,
  );

export function parseAssetQrPayload(rawValue: string): AssetQrPrefill | null {
  try {
    const raw = rawValue.trim();
    if (!raw) {
      return null;
    }

    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      const normalized = readFromObject(parsed as Record<string, unknown>);
      return hasMeaningfulPrefill(normalized) ? normalized : null;
    }

    if (
      raw.toLowerCase().startsWith(LEGACY_ASSETCARE_QR_PREFIX) ||
      raw.toLowerCase().startsWith(ASSETLY_QR_PREFIX)
    ) {
      const normalizedUrl = raw
        .replace(/^assetcare:\/\//i, "https://assetly.local/")
        .replace(/^assetly:\/\//i, "https://assetly.local/");
      const url = new URL(normalizedUrl);
      const params = url.searchParams;

      const normalized: AssetQrPrefill = {
        assetId: toOptionalText(params.get("asset_id") ?? params.get("assetId") ?? params.get("id")),
        name: toOptionalText(params.get("name")),
        category: toOptionalText(params.get("category")),
        serialNumber: toOptionalText(
          params.get("serial") ?? params.get("serial_number") ?? params.get("serialNumber"),
        ),
        brand: toOptionalText(params.get("brand")),
        model: toOptionalText(params.get("model")),
        purchaseDate: toOptionalDate(params.get("purchase_date") ?? params.get("purchaseDate")),
        warrantyEndDate: toOptionalDate(
          params.get("warranty_end_date") ?? params.get("warrantyEndDate"),
        ),
      };

      return hasMeaningfulPrefill(normalized) ? normalized : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function buildAssetQrPayload(source: AssetQrPayloadSource) {
  const params = new URLSearchParams();
  params.set("asset_id", source.assetId);
  params.set("name", source.name);
  params.set("category", source.category);

  if (source.serialNumber?.trim()) {
    params.set("serial", source.serialNumber.trim());
  }

  if (source.brand?.trim()) {
    params.set("brand", source.brand.trim());
  }

  if (source.model?.trim()) {
    params.set("model", source.model.trim());
  }

  return `${ASSETLY_QR_PREFIX}${params.toString()}`;
}

export function resolveAssetQrPayload(source: AssetQrPayloadRecord) {
  const storedQrCode = source.qrCode?.trim() ?? "";
  if (storedQrCode) {
    const parsed = parseAssetQrPayload(storedQrCode);
    if (parsed?.assetId === source.assetId) {
      return storedQrCode;
    }
  }

  return buildAssetQrPayload(source);
}
