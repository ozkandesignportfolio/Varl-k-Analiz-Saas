import { AppEventType } from "@/lib/events/app-event";

/**
 * NOTIFICATION MAPPERS
 * ============================================================================
 * DB → DTO ve domain → UI mapping fonksiyonları.
 * - Asset event UI copy üretimi
 * - Context normalization
 * ============================================================================
 */

export type AssetEventType =
  | AppEventType.ASSET_CREATED
  | AppEventType.ASSET_UPDATED;

export type AssetUiCopy = {
  title: string;
  message: string;
};

/**
 * Asset event tipine göre UI metinleri üretir.
 */
export const buildAssetUiCopy = (
  eventType: AssetEventType,
  assetName: string,
): AssetUiCopy => {
  const safeName = assetName?.trim() || "Varlık";
  switch (eventType) {
    case AppEventType.ASSET_CREATED:
      return {
        title: "Yeni varlık eklendi",
        message: `"${safeName}" varlığı başarıyla oluşturuldu.`,
      };
    case AppEventType.ASSET_UPDATED:
      return {
        title: "Varlık güncellendi",
        message: `"${safeName}" varlığının bilgileri güncellendi.`,
      };
    default:
      // Exhaustive check
      const _exhaustive: never = eventType;
      throw new Error(`Unknown asset event type: ${_exhaustive}`);
  }
};

export type RequestContext = {
  route: string;
  method: string;
};

/**
 * Observability context normalizasyonu.
 */
export const normalizeContext = (ctx?: { route?: string; method?: string }): RequestContext => ({
  route: ctx?.route?.trim() || "unknown",
  method: ctx?.method?.trim() || "POST",
});
