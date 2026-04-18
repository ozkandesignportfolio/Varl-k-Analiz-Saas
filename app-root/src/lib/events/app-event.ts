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
      /** `automation_events.id` — her başarılı dispatch için tekil ve zorunlu. */
      eventId: string;
      deduped: boolean;
      /** Deduped ise undefined — ilk dispatch'ten gelen notificationId kalır. */
      notificationId?: string;
    }
  | {
      ok: true;
      type: AppEventType.USER_WELCOME;
      eventId: string;
      notificationId: string;
    }
  | {
      ok: true;
      type: AppEventType.TEST_NOTIFICATION;
      /** Batch dispatch — her draft için oluşturulan anchor event id'leri. */
      eventIds: string[];
      successful: number;
      failed: number;
    };

/**
 * Dispatch pipeline aşamaları. Her `dispatch(event)` çağrısı bu sıradan geçer:
 *   VALIDATE → PERSIST_EVENT → CREATE_NOTIFICATION → SIDE_EFFECTS → COMPLETE
 *
 * Failure sonucunda `stage` alanı hatanın hangi aşamada oluştuğunu tek kaynaktan
 * gösterir. String literal kullanılmaz.
 */
export enum DispatchStage {
  VALIDATE = "VALIDATE",
  PERSIST_EVENT = "PERSIST_EVENT",
  CREATE_NOTIFICATION = "CREATE_NOTIFICATION",
  SIDE_EFFECTS = "SIDE_EFFECTS",
  COMPLETE = "COMPLETE",
}

/**
 * Standart dispatch hata kodları. Bir hata durumunda
 * `{ code: DispatchErrorCode }` alanı observability ve dead-letter kayıtlarında
 * tek kaynak olarak kullanılır. String literal ile kod üretmek YASAK.
 */
export enum DispatchErrorCode {
  INVALID_DISPATCH_INPUT = "INVALID_DISPATCH_INPUT",
  INVALID_STAGE_TRANSITION = "INVALID_STAGE_TRANSITION",
  MISSING_USER_ID = "MISSING_USER_ID",
  MISSING_DEDUPE_KEY = "MISSING_DEDUPE_KEY",
  MISSING_EVENT_ID = "MISSING_EVENT_ID",
  MISSING_TITLE = "MISSING_TITLE",
  MISSING_MESSAGE = "MISSING_MESSAGE",
  FORBIDDEN_PAYLOAD_KEY = "FORBIDDEN_PAYLOAD_KEY",
  EVENT_INSERT_FAILED = "EVENT_INSERT_FAILED",
  EVENT_ID_UNRESOLVED = "EVENT_ID_UNRESOLVED",
  NOTIFICATION_CREATE_FAILED = "NOTIFICATION_CREATE_FAILED",
  DUPLICATE_EVENT_SUPPRESSED = "DUPLICATE_EVENT_SUPPRESSED",
  RPC_FAILED = "RPC_FAILED",
  EXCEPTION = "EXCEPTION",
}

export type DispatchFailure = {
  ok: false;
  type: AppEventType;
  /** İnsan okunur hata mesajı. Observability için serbest metin. */
  error: string;
  /**
   * Standart hata kodu — zorunlu, yalnızca `DispatchErrorCode` enum üyelerinden
   * biri olabilir. Serbest string yasak. Dead-letter ve metric aggregator tek
   * kaynaktan okur.
   */
  code: DispatchErrorCode;
  stage: DispatchStage;
};

export type DispatchResult = DispatchSuccess | DispatchFailure;

/**
 * Exhaustiveness guard — switch varyantlarında eksik kalan event olduğunda
 * derleme hatası üretir.
 */
export const assertNever = (value: never): never => {
  throw new Error(`[events] Unhandled AppEvent variant: ${JSON.stringify(value)}`);
};
