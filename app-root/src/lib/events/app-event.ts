/**
 * CENTRALIZED APPLICATION EVENT CONTRACT
 * ---------------------------------------------------------------------------
 * Bütün iş akışı olayları BURADA tanımlanır. Hiçbir iş mantığı, bildirim/otomasyon
 * tetiklemek için string literal kullanamaz — yalnızca `AppEventType` ve
 * `AppEvent` tüketilir.
 *
 * Sözleşmeler:
 *  - `AppEventType` enum'ı tek kimlik kaynağıdır. Yeni event eklerken bu enum
 *    ve `AppEvent` birliği birlikte genişletilir (exhaustive switch devrede).
 *  - Payload tipleri discriminated union ile zorlanır. `event.type` kontrolü
 *    TypeScript'te payload daraltır.
 *  - Bu dosya server/client ortak olabilir — hiçbir DB/side-effect içermez.
 */

export enum AppEventType {
  ASSET_CREATED = "ASSET_CREATED",
  ASSET_UPDATED = "ASSET_UPDATED",
  USER_WELCOME = "USER_WELCOME",
  TEST_NOTIFICATION = "TEST_NOTIFICATION",
}

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

export type AssetCreatedEvent = {
  type: AppEventType.ASSET_CREATED;
  userId: string;
  assetId: string;
  assetName: string;
  payload?: Record<string, unknown>;
};

export type AssetUpdatedEvent = {
  type: AppEventType.ASSET_UPDATED;
  userId: string;
  assetId: string;
  assetName: string;
  /**
   * Idempotency anchor. Aynı güncellemeye ait her tetikleme aynı `changeVersion`'u
   * taşımalıdır. Pratikte: `data.updated_at` veya değişen alan listesinin
   * sıralı join'i.
   */
  changeVersion: string;
  payload?: Record<string, unknown>;
};

export type UserWelcomeEvent = {
  type: AppEventType.USER_WELCOME;
  userId: string;
};

export type TestNotificationEvent = {
  type: AppEventType.TEST_NOTIFICATION;
  userId: string;
};

export type AppEvent =
  | AssetCreatedEvent
  | AssetUpdatedEvent
  | UserWelcomeEvent
  | TestNotificationEvent;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export const isAssetCreatedEvent = (e: AppEvent): e is AssetCreatedEvent =>
  e.type === AppEventType.ASSET_CREATED;

export const isAssetUpdatedEvent = (e: AppEvent): e is AssetUpdatedEvent =>
  e.type === AppEventType.ASSET_UPDATED;

export const isUserWelcomeEvent = (e: AppEvent): e is UserWelcomeEvent =>
  e.type === AppEventType.USER_WELCOME;

export const isTestNotificationEvent = (e: AppEvent): e is TestNotificationEvent =>
  e.type === AppEventType.TEST_NOTIFICATION;

// ---------------------------------------------------------------------------
// Dispatch result contract
// ---------------------------------------------------------------------------

export type DispatchSuccess =
  | {
      ok: true;
      type: AppEventType.ASSET_CREATED | AppEventType.ASSET_UPDATED;
      deduped: boolean;
      notificationId?: string;
    }
  | {
      ok: true;
      type: AppEventType.USER_WELCOME;
      notificationId: string;
    }
  | {
      ok: true;
      type: AppEventType.TEST_NOTIFICATION;
      successful: number;
      failed: number;
    };

export type DispatchFailure = {
  ok: false;
  type: AppEventType;
  error: string;
  code?: string;
  stage?: string;
};

export type DispatchResult = DispatchSuccess | DispatchFailure;

/**
 * Exhaustiveness guard — switch varyantlarında eksik kalan event olduğunda
 * derleme hatası üretir.
 */
export const assertNever = (value: never): never => {
  throw new Error(`[events] Unhandled AppEvent variant: ${JSON.stringify(value)}`);
};
