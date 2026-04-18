import { createHash } from "crypto";
import { AppEventType, type AppEvent } from "@/lib/events/app-event";

/**
 * DEDUPE KEY UTILS
 * ============================================================================
 * Deterministik idempotency anahtar üretimi.
 * - SHA-256 hex encoding (kalıcı ve çarpışmaya dayanıklı)
 * - Event type + userId + entityId + timeBucket kombinasyonu
 * ============================================================================
 */

export type DedupeKeyParts = {
  eventType: AppEventType;
  userId: string;
  /** Üretici varlığın ID'si (asset, subscription vb.) veya null. */
  entityId?: string | null;
  /**
   * Zaman/versiyon bucket'ı. ASSET_UPDATED için `changeVersion`;
   * tek-sefer event'ler için null.
   */
  timeBucket?: string | null;
};

export type DispatchIdentity = {
  dedupeKey: string;
  eventType: AppEventType;
  userId: string;
};

/**
 * Deterministik idempotency anahtarı üretir.
 * Aynı input → aynı output (SHA-256 hex).
 */
export const buildDedupeKey = (parts: DedupeKeyParts): string => {
  const raw = [
    parts.eventType,
    parts.userId,
    parts.entityId ?? "",
    parts.timeBucket ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
};

/**
 * AppEvent'ten DispatchIdentity (dedupeKey + metadata) çözümü.
 */
export const resolveDispatchIdentity = (event: AppEvent): DispatchIdentity => {
  switch (event.type) {
    case AppEventType.ASSET_CREATED:
      return {
        eventType: event.type,
        userId: event.userId,
        dedupeKey: buildDedupeKey({
          eventType: AppEventType.ASSET_CREATED,
          userId: event.userId,
          entityId: event.assetId,
        }),
      };
    case AppEventType.ASSET_UPDATED:
      return {
        eventType: event.type,
        userId: event.userId,
        dedupeKey: buildDedupeKey({
          eventType: AppEventType.ASSET_UPDATED,
          userId: event.userId,
          entityId: event.assetId,
          timeBucket: event.changeVersion,
        }),
      };
    case AppEventType.USER_WELCOME:
      return {
        eventType: event.type,
        userId: event.userId,
        dedupeKey: buildDedupeKey({
          eventType: AppEventType.USER_WELCOME,
          userId: event.userId,
        }),
      };
    case AppEventType.TEST_NOTIFICATION:
      return {
        eventType: event.type,
        userId: event.userId,
        dedupeKey: buildDedupeKey({
          eventType: AppEventType.TEST_NOTIFICATION,
          userId: event.userId,
        }),
      };
    default:
      // TypeScript exhaustive check
      const _exhaustive: never = event;
      throw new Error(`Unknown event type: ${_exhaustive}`);
  }
};
