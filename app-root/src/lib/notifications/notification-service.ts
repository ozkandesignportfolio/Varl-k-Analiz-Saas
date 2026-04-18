import "server-only";

import { createHash, randomUUID } from "crypto";
import { logApiError } from "@/lib/api/logging";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppEventType,
  DispatchStage,
  DispatchErrorCode,
  assertNever,
  type AppEvent,
  type DispatchResult,
} from "@/lib/events/app-event";

/**
 * UNIFIED NOTIFICATION SERVICE
 * ---------------------------------------------------------------------------
 * Tüm bildirim yazımlarının TEK girişi. Önceden üç ayrı dosyaya yayılmış
 * sorumlulukları (`notification-service`, `enqueue-ui-notification`,
 * `generate-test-notifications`) burada toplar.
 *
 * Sözleşmeler:
 *  - Tek DB yazıcı: `notifications` ve `automation_events` tablolarına yazım
 *    yalnızca bu servisten geçer. Başka modül bu tablolara INSERT/UPSERT yapmaz.
 *  - Duplicate'siz: `notifyAssetEvent` önce dedupe-anahtarlı bir
 *    `automation_events` upsert'ü yapar; satır zaten varsa UI bildirimi
 *    TEKRAR yazılmaz.
 *  - Structured error: Her başarısızlık `{ ok: false, error, code }` döner ve
 *    `logApiError` ile yapılandırılmış log üretilir. Hiç bir sessiz yutma yok.
 *  - Realtime: UI realtime akışı Supabase `postgres_changes` aboneliği ile
 *    `notifications` tablosundan otomatik tetiklenir — DB INSERT'in kendisi
 *    UI "event"'idir, ayrıca broadcast edilmez.
 */

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export type NotificationType = "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem";

export type NotificationResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code: DispatchErrorCode };

export type NotificationBatchResult = {
  successful: string[];
  /**
   * Batch dispatch'te oluşan `automation_events.id`'leri (traceability).
   * `createBatch` kullanımında notification id'ler; `generateTestNotifications`
   * kullanımında anchor event id'leri.
  */
  eventIds: string[];
  failed: Array<{ error: string; code: DispatchErrorCode }>;
};

export type CreateNotificationInput = {
  userId: string;
  /**
   * Zorunlu traceability anchor: her notification tam olarak bir
   * `automation_events` satırına referans verir. Bu alan olmadan yazım yapılmaz
   * ve DB seviyesinde NOT NULL + FK tarafından tekrar zorlanır.
   */
  eventId: string;
  title: string;
  message: string;
  type: NotificationType;
  source?: string;
  actionHref?: string;
  actionLabel?: string;
  /** Observability context (logApiError'a aktarılır). */
  context?: { route?: string; method?: string };
};

export type AutomationTriggerType =
  | "maintenance_7_days"
  | "warranty_30_days"
  | "subscription_due"
  | "service_log_created"
  | "app_event";

export type EnqueueAutomationEventInput = {
  userId: string;
  triggerType: AutomationTriggerType;
  dedupeKey: string;
  actions?: Array<"email" | "push" | "sms">;
  assetId?: string | null;
  ruleId?: string | null;
  serviceLogId?: string | null;
  /**
   * Uygulama event kimliği. `automation_events.event_type` tipli kolonuna
   * yazılır. Null ise bu satır bir DB-domain trigger'ı (ör. cron kaynaklı
   * `maintenance_7_days`) sayılır ve kolon null kalır. Payload içine event
   * kimliği YAZILMAZ (CHECK constraint ile yasak).
   */
  eventType?: AppEventType | null;
  payload?: Record<string, unknown>;
  runAfter?: string;
  context?: { route?: string; method?: string };
};

export type AutomationEnqueueResult =
  | {
      ok: true;
      inserted: boolean;
      /**
       * `automation_events.id` — başarılı her enqueue sonucunda (yeni eklendi
       * VEYA dedupe ile mevcut satıra eriflildi) daima dolu. Downstream
       * `createNotification` için traceability anchorıdır.
       */
      eventId: string;
    }
  | { ok: false; error: string; code: DispatchErrorCode };

/**
 * Asset bildirimlerini tetikleyen app event kimliği.
 *
 * Servis katında asset-spesifik bir string literal KULLANILMAZ — kimlik yalnızca
 * `AppEventType.ASSET_CREATED` veya `AppEventType.ASSET_UPDATED` olabilir.
 * DB tarafında event kimliği tipli `automation_events.event_type` kolonunda
 * tutulur; payload'a asla yazılmaz (CHECK constraint + runtime guard).
 */
export type AssetEventType =
  | AppEventType.ASSET_CREATED
  | AppEventType.ASSET_UPDATED;

export type NotifyAssetEventInput = {
  userId: string;
  eventType: AssetEventType;
  assetId: string;
  assetName: string;
  /** Idempotency anahtarı. Aynı anahtar için ikinci çağrıda yazım yapılmaz. */
  dedupeKey: string;
  payload?: Record<string, unknown>;
  context?: { route?: string; method?: string };
};

export type NotifyAssetEventResult =
  | { ok: true; deduped: false; eventId: string; notificationId: string }
  | { ok: true; deduped: true; eventId: string }
  | {
      ok: false;
      error: string;
      /** Zorunlu standart hata kodu. Serbest string yasak. */
      code: DispatchErrorCode;
      stage: DispatchStage;
    };

// ---------------------------------------------------------------------------
// İç yardımcılar
// ---------------------------------------------------------------------------

const SERVICE_TAG = "[notification-service]";

const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(`${SERVICE_TAG} ${event}`, payload);
};

// ---------------------------------------------------------------------------
// Observability: dispatch metric emitter
//
// Her dispatch çağrısı için stdout'a tek satır yapılandırılmış JSON log yazar.
// Log aggregator (Vercel / Supabase logs / Datadog) bu satırları counter ve
// histogram olarak türetir:
//   - outcome="created"  -> event_created_count, notification_created_count
//   - outcome="deduped"  -> dedupe_suppressed_count
//   - outcome="failed"   -> event_failed_count | notification_failed_count
//   - latency_ms         -> dispatch_latency_ms histogramı
// String literal kaçağı yok: stage/code alanları enum değerleriyle gelir.
// ---------------------------------------------------------------------------
type DispatchMetricOutcome = "created" | "deduped" | "failed";

const emitDispatchMetric = (payload: {
  outcome: DispatchMetricOutcome;
  eventType: AppEventType | null;
  userId: string | null;
  eventId: string | null;
  dedupeKey: string | null;
  latencyMs: number;
  stage: DispatchStage | null;
  code: DispatchErrorCode | null;
  notificationId?: string | null;
  error?: string | null;
  route?: string;
  method?: string;
}) => {
  try {
    process.stdout.write(
      `${JSON.stringify({
        event: "dispatch:outcome",
        eventId: payload.eventId,
        userId: payload.userId,
        eventType: payload.eventType,
        dedupeKey: payload.dedupeKey,
        stage: payload.stage,
        code: payload.code,
        latencyMs: Math.max(0, Math.round(payload.latencyMs)),
        outcome: payload.outcome,
      })}\n`,
    );
  } catch {
    // Serialization hatası durumunda bile dispatch akışını bozmayız.
  }
};

// ---------------------------------------------------------------------------
// Dead letter: kalıcı dispatch hatalarını kaydet
//
// Kaydın kendisi başarısız olsa bile dispatch akışını bozmaz (best-effort).
// Böylece monitoring logları kaybolursa bile operator bir tablo üzerinden
// hatalı event'leri sorgulayabilir.
// ---------------------------------------------------------------------------
const recordDeadLetter = async (
  adminClient: SupabaseClient,
  input: {
    userId: string | null;
    eventType: AppEventType | null;
    dedupeKey: string | null;
    triggerType: string | null;
    stage: DispatchStage;
    code: DispatchErrorCode | null;
    message: string;
    payload: Record<string, unknown>;
    route?: string | null;
    method?: string | null;
  },
): Promise<void> => {
  try {
    const { error } = await adminClient.from("dead_letter_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      dedupe_key: input.dedupeKey,
      trigger_type: input.triggerType,
      stage: input.stage,
      error_code: input.code,
      error_message: input.message,
      payload: input.payload ?? {},
      route: input.route ?? null,
      method: input.method ?? null,
    });
    void error;
  } catch {}
};

const normalizeContext = (ctx?: { route?: string; method?: string }) => ({
  route: ctx?.route?.trim() || "unknown",
  method: ctx?.method?.trim() || "POST",
});

class DispatchInvariantError extends Error {
  readonly code: DispatchErrorCode;
  readonly stage: DispatchStage;

  constructor(message: string, code: DispatchErrorCode, stage: DispatchStage) {
    super(message);
    this.name = "DispatchInvariantError";
    this.code = code;
    this.stage = stage;
  }
}

const isDispatchInvariantError = (error: unknown): error is DispatchInvariantError =>
  error instanceof DispatchInvariantError;

const failDispatch = (
  message: string,
  code: DispatchErrorCode,
  stage: DispatchStage,
): never => {
  throw new DispatchInvariantError(message, code, stage);
};

const DISPATCH_STAGE_ORDER: DispatchStage[] = [
  DispatchStage.VALIDATE,
  DispatchStage.PERSIST_EVENT,
  DispatchStage.CREATE_NOTIFICATION,
  DispatchStage.SIDE_EFFECTS,
  DispatchStage.COMPLETE,
];

const assertDispatchStageTransition = (
  currentStage: DispatchStage,
  nextStage: DispatchStage,
): void => {
  const currentIndex = DISPATCH_STAGE_ORDER.indexOf(currentStage);
  const nextIndex = DISPATCH_STAGE_ORDER.indexOf(nextStage);
  if (currentIndex === -1 || nextIndex === -1 || nextIndex < currentIndex) {
    failDispatch(
      `Invalid dispatch stage transition: ${currentStage} -> ${nextStage}`,
      DispatchErrorCode.INVALID_STAGE_TRANSITION,
      nextStage,
    );
  }
};

const advanceDispatchStage = (
  currentStage: DispatchStage,
  nextStage: DispatchStage,
): DispatchStage => {
  assertDispatchStageTransition(currentStage, nextStage);
  return nextStage;
};

/**
 * Deterministik idempotency anahtarı. Aynı `(eventType, userId, entityId,
 * timeBucket)` dizisi aynı anahtarı üretir; eşzamanlı yeniden deneme ve tekrar
 * dispatch örneklerinde DB'deki UNIQUE(dedupe_key) + ON CONFLICT semantiği ile
 * birleşip duplicate yazılmasını engeller. SHA-256 hex; kalıcı ve çarpışmaya
 * dayanıklı.
 */
const buildDedupeKey = (parts: {
  eventType: AppEventType;
  userId: string;
  /** Üretici varlığın ID'si (asset, subscription vb.) veya null. */
  entityId?: string | null;
  /**
   * Zaman/versiyon bucket’ı. ASSET_UPDATED için `changeVersion`; tek-sefer
   * event'ler (ASSET_CREATED, USER_WELCOME) için null.
   */
  timeBucket?: string | null;
}): string => {
  const raw = [
    parts.eventType,
    parts.userId,
    parts.entityId ?? "",
    parts.timeBucket ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
};

/**
 * Payload içinde event kimliği taşıyan legacy anahtarların yazılmasını runtime'da
 * engeller. DB'de `automation_events_payload_no_event_identity_keys` CHECK
 * constraint'i zaten bu ihlali reddeder; bu guard ilk savunma hattıdır ve hata
 * mesajını uygulama katmanında anlaşılır kılar.
 */
const FORBIDDEN_PAYLOAD_KEYS = ["event_type", "notification_kind"] as const;

const assertNoEventIdentityInPayload = (
  payload: Record<string, unknown> | undefined,
): void => {
  if (!payload) return;
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (key in payload) {
      failDispatch(
        `Payload must not contain event identity key '${key}'. Use automation_events.event_type column instead.`,
        DispatchErrorCode.FORBIDDEN_PAYLOAD_KEY,
        DispatchStage.VALIDATE,
      );
    }
  }
};

const assertValidDispatchInput = (input: {
  userId?: string | null;
  dedupeKey?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  notificationTitle?: string | null;
  notificationMessage?: string | null;
}): void => {
  if (!input.userId?.trim()) {
    failDispatch("User ID is required", DispatchErrorCode.MISSING_USER_ID, DispatchStage.VALIDATE);
  }
  if (input.dedupeKey != null && !input.dedupeKey.trim()) {
    failDispatch(
      "dedupeKey is required",
      DispatchErrorCode.MISSING_DEDUPE_KEY,
      DispatchStage.VALIDATE,
    );
  }
  if (input.assetId != null && !input.assetId.trim()) {
    failDispatch(
      "Asset ID is required",
      DispatchErrorCode.INVALID_DISPATCH_INPUT,
      DispatchStage.VALIDATE,
    );
  }
  if (input.assetName != null && !input.assetName.trim()) {
    failDispatch(
      "Asset name is required",
      DispatchErrorCode.INVALID_DISPATCH_INPUT,
      DispatchStage.VALIDATE,
    );
  }
  if (input.notificationTitle != null && !input.notificationTitle.trim()) {
    failDispatch(
      "Notification title is required",
      DispatchErrorCode.MISSING_TITLE,
      DispatchStage.VALIDATE,
    );
  }
  if (input.notificationMessage != null && !input.notificationMessage.trim()) {
    failDispatch(
      "Notification message is required",
      DispatchErrorCode.MISSING_MESSAGE,
      DispatchStage.VALIDATE,
    );
  }
};

type DispatchIdentity = {
  dedupeKey: string;
  eventType: AppEventType;
  userId: string;
};

type DispatchAppEventRow = {
  event_id: string | null;
  notification_id: string | null;
  event_inserted: boolean | null;
  notification_created: boolean | null;
};

const resolveDispatchIdentity = (event: AppEvent): DispatchIdentity => {
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
      return assertNever(event);
  }
};

const buildAssetUiCopy = (
  eventType: AssetEventType,
  assetName: string,
): { title: string; message: string } => {
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
      return assertNever(eventType);
  }
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type NotificationService = {
  /**
   * Tek resmi event girişi. Business logic `dispatch(event)` dışında bir şey
   * ÇAĞIRMAMALI. Diğer metodlar düşük seviye implementasyon detayıdır.
   */
  dispatch: (
    event: AppEvent,
    context?: { route?: string; method?: string },
  ) => Promise<DispatchResult>;

  // Düşük seviye — servis içi ve legacy tüketim. Yeni iş mantığı `dispatch`
  // kullanmalıdır.
  createNotification: (input: CreateNotificationInput) => Promise<NotificationResult>;
  createBatch: (inputs: CreateNotificationInput[]) => Promise<NotificationBatchResult>;
  enqueueAutomationEvent: (
    input: EnqueueAutomationEventInput,
  ) => Promise<AutomationEnqueueResult>;
  notifyAssetEvent: (input: NotifyAssetEventInput) => Promise<NotifyAssetEventResult>;
  generateTestNotifications: (userId: string) => Promise<NotificationBatchResult>;
};

export const createNotificationService = (
  /** Test/injection için. Varsayılan: service-role admin client singleton. */
  adminClient: SupabaseClient = getSupabaseAdmin(),
): NotificationService => {
  // -------------------------------------------------------------------------
  // createNotification — tek resmi `notifications` yazıcı
  // -------------------------------------------------------------------------
  const createNotification = async (
    input: CreateNotificationInput,
  ): Promise<NotificationResult> => {
    const { userId, eventId, title, message, type, source, actionHref, actionLabel } = input;
    const { route, method } = normalizeContext(input.context);

    logEvent("CREATE_ATTEMPT", { userId, eventId, title, type, route });

    if (!userId?.trim()) {
      return { ok: false, error: "User ID is required", code: DispatchErrorCode.MISSING_USER_ID };
    }
    if (!eventId?.trim()) {
      // Traceability invariant: her notification bir automation_events satırına
      // anchor olmalı. Bu kontrol uygulama seviyesinde ilk savunma hattı;
      // DB'de NOT NULL + FK ile tekrar zorlanır.
      return { ok: false, error: "eventId is required", code: DispatchErrorCode.MISSING_EVENT_ID };
    }
    if (!title?.trim()) {
      return { ok: false, error: "Title is required", code: DispatchErrorCode.MISSING_TITLE };
    }
    if (!message?.trim()) {
      return { ok: false, error: "Message is required", code: DispatchErrorCode.MISSING_MESSAGE };
    }

    try {
      const row: Record<string, unknown> = {
        user_id: userId,
        event_id: eventId,
        title: title.trim(),
        message: message.trim(),
        type,
        is_read: false,
      };
      if (source) row.source = source;
      if (actionHref) row.action_href = actionHref;
      if (actionLabel) row.action_label = actionLabel;

      const { data, error } = await adminClient
        .from("notifications")
        .insert(row)
        .select("id")
        .single();

      if (error) {
        logEvent("CREATE_FAILED", {
          userId,
          error: error.message,
          code: error.code,
          route,
        });
        logApiError({
          route,
          method,
          userId,
          error,
          status: 500,
          message: "Failed to create notification",
          meta: { title, type },
        });
        return {
          ok: false,
          error: `Database error: ${error.message}`,
          code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
        };
      }

      if (!data?.id) {
        logEvent("CREATE_FAILED", { userId, error: "No ID returned", route });
        return {
          ok: false,
          error: "No ID returned from insert",
          code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
        };
      }

      logEvent("CREATE_SUCCESS", { userId, notificationId: data.id, type, route });
      return { ok: true, id: data.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logEvent("CREATE_EXCEPTION", { userId, error: errorMsg, route });
      logApiError({
        route,
        method,
        userId,
        error,
        status: 500,
        message: "Exception creating notification",
        meta: { title, type },
      });
      return { ok: false, error: `Exception: ${errorMsg}`, code: DispatchErrorCode.EXCEPTION };
    }
  };

  const createBatch = async (
    inputs: CreateNotificationInput[],
  ): Promise<NotificationBatchResult> => {
    logEvent("BATCH_ATTEMPT", { count: inputs.length });

    const result: NotificationBatchResult = { successful: [], eventIds: [], failed: [] };
    for (const input of inputs) {
      const r = await createNotification(input);
      if (r.ok) {
        result.successful.push(r.id);
        result.eventIds.push(input.eventId);
      } else {
        result.failed.push({ error: r.error, code: r.code });
      }
    }

    logEvent("BATCH_COMPLETE", {
      attempted: inputs.length,
      successful: result.successful.length,
      failed: result.failed.length,
    });
    return result;
  };

  // -------------------------------------------------------------------------
  // enqueueAutomationEvent — tek resmi `automation_events` yazıcı
  // -------------------------------------------------------------------------
  const enqueueAutomationEvent = async (
    input: EnqueueAutomationEventInput,
  ): Promise<AutomationEnqueueResult> => {
    const { userId, triggerType, dedupeKey } = input;
    const { route, method } = normalizeContext(input.context);

    if (!userId?.trim()) {
      return { ok: false, error: "User ID is required", code: DispatchErrorCode.MISSING_USER_ID };
    }
    if (!dedupeKey?.trim()) {
      return {
        ok: false,
        error: "dedupeKey is required",
        code: DispatchErrorCode.MISSING_DEDUPE_KEY,
      };
    }

    // Payload guard: event kimliği taşıyan legacy anahtarlar yasak. DB CHECK'i
    // yanında runtime'da da reddediyoruz ki caller anlaşılır bir hata alsın.
    try {
      assertNoEventIdentityInPayload(input.payload);
    } catch (error) {
      if (isDispatchInvariantError(error)) {
        logEvent("AUTOMATION_PAYLOAD_GUARD", { userId, dedupeKey, error: error.message });
        return { ok: false, error: error.message, code: error.code };
      }
      throw error;
    }

    const row = {
      user_id: userId,
      asset_id: input.assetId ?? null,
      rule_id: input.ruleId ?? null,
      service_log_id: input.serviceLogId ?? null,
      trigger_type: triggerType,
      event_type: input.eventType ?? null,
      actions: input.actions ?? [],
      payload: input.payload ?? {},
      dedupe_key: dedupeKey,
      run_after: input.runAfter ?? new Date().toISOString(),
    };

    try {
      const { data, error } = await adminClient
        .from("automation_events")
        .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id");

      if (error) {
        logEvent("AUTOMATION_UPSERT_FAILED", {
          userId,
          dedupeKey,
          error: error.message,
          code: error.code,
        });
        logApiError({
          route,
          method,
          userId,
          error,
          status: 500,
          message: "Automation event upsert failed",
          meta: { triggerType, dedupeKey },
        });
        return {
          ok: false,
          error: `Database error: ${error.message}`,
          code: DispatchErrorCode.EVENT_INSERT_FAILED,
        };
      }

      // ignoreDuplicates=true → duplicate ise data boş dizi döner.
      const inserted = Array.isArray(data) && data.length > 0;
      let eventId: string | null = null;

      if (inserted) {
        eventId = (data?.[0]?.id as string | undefined) ?? null;
      } else {
        // Mevcut (duplicate) satırın id'sini dedupe_key üzerinden çöz — downstream
        // createNotification için traceability anchor'ı zorunlu.
        const existing = await adminClient
          .from("automation_events")
          .select("id")
          .eq("dedupe_key", dedupeKey)
          .maybeSingle();

        if (existing.error) {
          logApiError({
            route,
            method,
            userId,
            error: existing.error,
            status: 500,
            message: "Failed to resolve existing automation_event id for dedupe_key",
            meta: { triggerType, dedupeKey },
          });
          return {
            ok: false,
            error: `Database error: ${existing.error.message}`,
            code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
          };
        }
        eventId = (existing.data?.id as string | undefined) ?? null;
      }

      if (!eventId) {
        logEvent("AUTOMATION_UPSERT_NO_ID", { userId, dedupeKey, inserted });
        return {
          ok: false,
          error: "Could not resolve automation_events.id after upsert",
          code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
        };
      }

      logEvent("AUTOMATION_UPSERT", { userId, dedupeKey, inserted, eventId });
      return { ok: true, inserted, eventId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logApiError({
        route,
        method,
        userId,
        error,
        status: 500,
        message: "Exception upserting automation event",
        meta: { triggerType, dedupeKey },
      });
      return { ok: false, error: `Exception: ${errorMsg}`, code: DispatchErrorCode.EXCEPTION };
    }
  };

  // -------------------------------------------------------------------------
  // notifyAssetEvent — atomic (event + notification tek RPC'de)
  //
  // `dispatch_app_event` RPC iki kayıdı tek transaction'da ve retry-safe
  // biçimde yazar. Eğer önceki bir deneme event'i yazmış ama notification'ı
  // yazamadan başarısız olmuşsa, bu retry eksik notification'ı self-heal eder
  // (RPC içindeki "event var / notification yok" kontrolü).
  // -------------------------------------------------------------------------
  const notifyAssetEvent = async (
    input: NotifyAssetEventInput,
  ): Promise<NotifyAssetEventResult> => {
    const { userId, assetId, eventType } = input;
    const { route, method } = normalizeContext(input.context);
    // Downstream dedupe_key servisin ürettiği semantiğe sadık kalsın
    // (mevcut ":email" suffix'i idempotency contract'ının parçası).
    const dedupeKey = `${input.dedupeKey}:email`;

    const assetCategory =
      typeof input.payload?.asset_category === "string"
        ? input.payload.asset_category
        : typeof input.payload?.category === "string"
          ? input.payload.category
          : null;

    // Payload yalnızca sunum/yardımcı alanları taşır. Event kimliği kolonda.
    const eventPayload: Record<string, unknown> = {
      asset_name: input.assetName,
      action_href: `/assets/${assetId}`,
      email_only: true,
      ...(assetCategory ? { asset_category: assetCategory } : {}),
      ...input.payload,
    };
    const copy = buildAssetUiCopy(eventType, input.assetName);
    let stage = DispatchStage.VALIDATE;

    try {
      assertValidDispatchInput({
        userId,
        dedupeKey,
        assetId,
        assetName: input.assetName,
        notificationTitle: copy.title,
        notificationMessage: copy.message,
      });
      assertNoEventIdentityInPayload(eventPayload);
      stage = advanceDispatchStage(stage, DispatchStage.PERSIST_EVENT);

      const { data, error } = await adminClient.rpc("dispatch_app_event", {
        p_user_id: userId,
        p_dedupe_key: dedupeKey,
        p_trigger_type: "service_log_created",
        p_event_type: eventType,
        p_asset_id: assetId ?? null,
        p_rule_id: null,
        p_service_log_id: null,
        p_actions: ["email"],
        p_payload: eventPayload,
        p_run_after: new Date().toISOString(),
        p_notification_title: copy.title,
        p_notification_message: copy.message,
        p_notification_type: "Sistem",
        p_notification_source: null,
        p_notification_action_href: `/assets/${assetId}`,
        p_notification_action_label: null,
      });

      if (error) {
        await recordDeadLetter(adminClient, {
          userId,
          eventType,
          dedupeKey,
          triggerType: "service_log_created",
          stage,
          code: DispatchErrorCode.RPC_FAILED,
          message: error.message,
          payload: eventPayload,
          route,
          method,
        });
        return {
          ok: false,
          error: `Database error: ${error.message}`,
          code: DispatchErrorCode.RPC_FAILED,
          stage: DispatchStage.PERSIST_EVENT,
        };
      }

      const row = (Array.isArray(data) ? data[0] : data) as DispatchAppEventRow | null;
      const eventId = row?.event_id ?? null;
      const notificationId = row?.notification_id ?? null;
      const notificationCreated = Boolean(row?.notification_created);

      if (!eventId) {
        await recordDeadLetter(adminClient, {
          userId,
          eventType,
          dedupeKey,
          triggerType: "service_log_created",
          stage: DispatchStage.PERSIST_EVENT,
          code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
          message: "dispatch_app_event returned no event_id",
          payload: eventPayload,
          route,
          method,
        });
        return {
          ok: false,
          error: "dispatch_app_event returned no event_id",
          code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
          stage: DispatchStage.PERSIST_EVENT,
        };
      }

      stage = advanceDispatchStage(stage, DispatchStage.CREATE_NOTIFICATION);

      if (!notificationId) {
        await recordDeadLetter(adminClient, {
          userId,
          eventType,
          dedupeKey,
          triggerType: "service_log_created",
          stage,
          code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
          message: "dispatch_app_event returned no notification_id",
          payload: eventPayload,
          route,
          method,
        });
        return {
          ok: false,
          error: "dispatch_app_event returned no notification_id",
          code: DispatchErrorCode.NOTIFICATION_CREATE_FAILED,
          stage,
        };
      }

      stage = advanceDispatchStage(stage, DispatchStage.COMPLETE);

      // Notification oluşturulduysa (ilk dispatch veya self-heal) deduped=false.
      // Tam duplicate (event de notification da zaten vardı) → deduped=true.
      if (notificationCreated) {
        return { ok: true, deduped: false, eventId, notificationId };
      }
      return { ok: true, deduped: true, eventId };
    } catch (e) {
      if (isDispatchInvariantError(e)) {
        await recordDeadLetter(adminClient, {
          userId,
          eventType,
          dedupeKey,
          triggerType: "service_log_created",
          stage: e.stage,
          code: e.code,
          message: e.message,
          payload: eventPayload,
          route,
          method,
        });
        return {
          ok: false,
          error: e.message,
          code: e.code,
          stage: e.stage,
        };
      }

      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      await recordDeadLetter(adminClient, {
        userId,
        eventType,
        dedupeKey,
        triggerType: "service_log_created",
        stage,
        code: DispatchErrorCode.EXCEPTION,
        message: errorMsg,
        payload: eventPayload,
        route,
        method,
      });
      return {
        ok: false,
        error: `Exception: ${errorMsg}`,
        code: DispatchErrorCode.EXCEPTION,
        stage,
      };
    }
  };

  // -------------------------------------------------------------------------
  // generateTestNotifications — dev/test helper
  // -------------------------------------------------------------------------
  const TEST_RUN_AFTER = "2099-12-31T23:59:59.000Z";

  type TestDraft = {
    title: string;
    message: string;
    type: NotificationType;
    triggerType: AutomationTriggerType;
    eventType?: AppEventType;
    createdAt: string;
    actionHref: string;
    payload?: Record<string, unknown>;
  };

  const buildTestDrafts = (): TestDraft[] => {
    const now = Date.now();
    return [
      {
        title: "Varlık güncellendi",
        message: "Bir varlığınızın bilgileri güncellendi.",
        type: "Sistem",
        triggerType: "service_log_created",
        eventType: AppEventType.ASSET_UPDATED,
        createdAt: new Date(now).toISOString(),
        actionHref: "/assets",
      },
      {
        title: "Bakım zamanı yaklaşıyor",
        message: "Bir varlığınız için bakım tarihi yaklaşıyor.",
        type: "Bakım",
        triggerType: "maintenance_7_days",
        createdAt: new Date(now - 60_000).toISOString(),
        actionHref: "/maintenance",
      },
      {
        title: "Fatura gecikti",
        message: "Bir faturanızın son ödeme tarihi geçti.",
        type: "Ödeme",
        triggerType: "subscription_due",
        createdAt: new Date(now - 120_000).toISOString(),
        actionHref: "/billing",
      },
      {
        title: "Garanti bitmek üzere",
        message: "Bir varlığınızın garanti süresi yakında dolacak.",
        type: "Garanti",
        triggerType: "warranty_30_days",
        createdAt: new Date(now - 180_000).toISOString(),
        actionHref: "/assets",
      },
    ];
  };

  const generateTestNotifications = async (
    userId: string,
  ): Promise<NotificationBatchResult> => {
    const ctx = { route: "/api/notifications/test", method: "POST" as const };
    const result: NotificationBatchResult = { successful: [], eventIds: [], failed: [] };

    if (!userId?.trim()) {
      result.failed.push({
        error: "User ID is required",
        code: DispatchErrorCode.MISSING_USER_ID,
      });
      return result;
    }

    const drafts = buildTestDrafts();

    for (const draft of drafts) {
      const enqueue = await enqueueAutomationEvent({
        userId,
        triggerType: draft.triggerType,
        eventType: draft.eventType ?? null,
        dedupeKey: `test-notification:${userId}:${draft.triggerType}:${randomUUID()}`,
        assetId: null,
        payload: {
          title: draft.title,
          message: draft.message,
          type: draft.type,
          created_at: draft.createdAt,
          action_href: draft.actionHref,
          is_test_notification: true,
          ...draft.payload,
        },
        runAfter: TEST_RUN_AFTER,
        context: ctx,
      });

      if (!enqueue.ok) {
        result.failed.push({ error: enqueue.error, code: enqueue.code });
        continue;
      }
      result.successful.push(draft.triggerType);
      result.eventIds.push(enqueue.eventId);
    }

    logEvent("TEST_NOTIFICATIONS_COMPLETE", {
      userId,
      successful: result.successful.length,
      failed: result.failed.length,
    });
    return result;
  };

  // -------------------------------------------------------------------------
  // dispatch — tek resmi event girişi
  //   AppEvent discriminated union üzerinde exhaustive switch. Her varyant
  //   ilgili düşük seviye implementasyona yönlenir; sonuç DispatchResult ile
  //   normalleştirilir. Yeni bir AppEventType eklenirse assertNever derleme
  //   zamanında hata üretir.
  // -------------------------------------------------------------------------
  // Dispatch iç implementasyonu — dış `dispatch` wrapper'ı latency ölçüp
  // `emitDispatchMetric` ile outcome'u yapılandırılmış log olarak yayar.
  const dispatchInner = async (
    event: AppEvent,
    context?: { route?: string; method?: string },
  ): Promise<DispatchResult> => {
    switch (event.type) {
      case AppEventType.ASSET_CREATED: {
        const { dedupeKey } = resolveDispatchIdentity(event);
        const result = await notifyAssetEvent({
          userId: event.userId,
          eventType: AppEventType.ASSET_CREATED,
          assetId: event.assetId,
          assetName: event.assetName,
          dedupeKey,
          payload: event.payload,
          context,
        });
        if (!result.ok) {
          return {
            ok: false,
            type: event.type,
            error: result.error,
            code: result.code,
            stage: result.stage,
          };
        }
        return {
          ok: true,
          type: event.type,
          eventId: result.eventId,
          deduped: result.deduped,
          notificationId: result.deduped ? undefined : result.notificationId,
        };
      }

      case AppEventType.ASSET_UPDATED: {
        const { dedupeKey } = resolveDispatchIdentity(event);
        const result = await notifyAssetEvent({
          userId: event.userId,
          eventType: AppEventType.ASSET_UPDATED,
          assetId: event.assetId,
          assetName: event.assetName,
          dedupeKey,
          payload: event.payload,
          context,
        });
        if (!result.ok) {
          return {
            ok: false,
            type: event.type,
            error: result.error,
            code: result.code,
            stage: result.stage,
          };
        }
        return {
          ok: true,
          type: event.type,
          eventId: result.eventId,
          deduped: result.deduped,
          notificationId: result.deduped ? undefined : result.notificationId,
        };
      }

      case AppEventType.USER_WELCOME: {
        // USER_WELCOME atomic: event + notification tek RPC transaction'ında.
        // Retry-safe: önceki kısmi başarısızlık varsa (event yazıldı,
        // notification yazılamadı) RPC self-heal eder.
        const { route, method } = normalizeContext(context);
        const dedupeKey = buildDedupeKey({
          eventType: AppEventType.USER_WELCOME,
          userId: event.userId,
        });

        try {
          const { data, error } = await adminClient.rpc("dispatch_app_event", {
            p_user_id: event.userId,
            p_dedupe_key: dedupeKey,
            p_trigger_type: "app_event",
            p_event_type: AppEventType.USER_WELCOME,
            p_asset_id: null,
            p_rule_id: null,
            p_service_log_id: null,
            p_actions: [],
            p_payload: {},
            p_run_after: new Date().toISOString(),
            p_notification_title: "Hoş geldiniz",
            p_notification_message:
              "Assetly'ye hoş geldiniz! Bildirim sistemi aktif.",
            p_notification_type: "Sistem",
            p_notification_source: "system",
            p_notification_action_href: "/assets",
            p_notification_action_label: "Varlıklarım",
          });

          if (error) {
            logApiError({
              route,
              method,
              userId: event.userId,
              error,
              status: 500,
              message: "dispatch_app_event RPC failed (USER_WELCOME)",
              meta: { dedupeKey },
            });
            await recordDeadLetter(adminClient, {
              userId: event.userId,
              eventType: AppEventType.USER_WELCOME,
              dedupeKey,
              triggerType: "app_event",
              stage: DispatchStage.PERSIST_EVENT,
              code: DispatchErrorCode.RPC_FAILED,
              message: error.message,
              payload: {},
              route,
              method,
            });
            return {
              ok: false,
              type: event.type,
              error: `Database error: ${error.message}`,
              code: DispatchErrorCode.RPC_FAILED,
              stage: DispatchStage.PERSIST_EVENT,
            };
          }

          const row = Array.isArray(data) ? data[0] : data;
          const eventId = (row?.event_id as string | undefined) ?? null;
          const notificationId =
            (row?.notification_id as string | undefined) ?? null;

          if (!eventId || !notificationId) {
            await recordDeadLetter(adminClient, {
              userId: event.userId,
              eventType: AppEventType.USER_WELCOME,
              dedupeKey,
              triggerType: "app_event",
              stage: DispatchStage.PERSIST_EVENT,
              code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
              message: "dispatch_app_event returned incomplete row",
              payload: { eventId, notificationId },
              route,
              method,
            });
            return {
              ok: false,
              type: event.type,
              error: "dispatch_app_event returned incomplete row",
              code: DispatchErrorCode.EVENT_ID_UNRESOLVED,
              stage: DispatchStage.PERSIST_EVENT,
            };
          }

          return {
            ok: true,
            type: event.type,
            eventId,
            notificationId,
          };
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : "Unknown error";
          logApiError({
            route,
            method,
            userId: event.userId,
            error: e,
            status: 500,
            message: "Exception in dispatch_app_event (USER_WELCOME)",
            meta: { dedupeKey },
          });
          await recordDeadLetter(adminClient, {
            userId: event.userId,
            eventType: AppEventType.USER_WELCOME,
            dedupeKey,
            triggerType: "app_event",
            stage: DispatchStage.PERSIST_EVENT,
            code: DispatchErrorCode.EXCEPTION,
            message: errorMsg,
            payload: {},
            route,
            method,
          });
          return {
            ok: false,
            type: event.type,
            error: `Exception: ${errorMsg}`,
            code: DispatchErrorCode.EXCEPTION,
            stage: DispatchStage.PERSIST_EVENT,
          };
        }
      }

      case AppEventType.TEST_NOTIFICATION: {
        const batch = await generateTestNotifications(event.userId);
        // generateTestNotifications şu an asla top-level throw etmez; hata
        // varsa batch.failed'da toplanır. Kısmi başarı da OK sayılır.
        return {
          ok: true,
          type: event.type,
          eventIds: batch.eventIds,
          successful: batch.successful.length,
          failed: batch.failed.length,
        };
      }

      default:
        return assertNever(event);
    }
  };

  // -------------------------------------------------------------------------
  // dispatch — observability wrapper (timer + outcome metric)
  //
  // Tüm event girişlerini tek noktada ölçer ve `dispatch:outcome` yapılandırılmış
  // log satırı yayar. Log aggregator bu satırlardan şu metrikleri türetir:
  //   - event_created_count / notification_created_count (outcome="created")
  //   - dedupe_suppressed_count (outcome="deduped")
  //   - event_failed_count / notification_failed_count (outcome="failed")
  //   - dispatch_latency_ms histogramı (latency_ms alanı)
  // -------------------------------------------------------------------------
  const dispatch = async (
    event: AppEvent,
    context?: { route?: string; method?: string },
  ): Promise<DispatchResult> => {
    const startedAt = Date.now();
    const { route, method } = normalizeContext(context);
    const result = await dispatchInner(event, context);
    const latencyMs = Date.now() - startedAt;

    // Outcome + alan çıkarımı (string literal kaçağı yok; hep enum/union).
    let outcome: DispatchMetricOutcome;
    let eventId: string | null = null;
    let notificationId: string | null = null;
    let stage: DispatchStage | null = null;
    let code: DispatchErrorCode | null = null;
    let errorMsg: string | null = null;

    if (result.ok) {
      switch (result.type) {
        case AppEventType.ASSET_CREATED:
        case AppEventType.ASSET_UPDATED:
          eventId = result.eventId;
          notificationId = result.notificationId ?? null;
          outcome = result.deduped ? "deduped" : "created";
          break;
        case AppEventType.USER_WELCOME:
          eventId = result.eventId;
          notificationId = result.notificationId;
          outcome = "created";
          break;
        case AppEventType.TEST_NOTIFICATION:
          outcome = "created";
          break;
        default:
          outcome = "created";
      }
    } else {
      outcome = "failed";
      stage = result.stage;
      code = result.code ?? null;
      errorMsg = result.error;
    }

    emitDispatchMetric({
      outcome,
      eventType: event.type,
      userId: event.userId,
      eventId,
      dedupeKey: null,
      notificationId,
      latencyMs,
      stage,
      code,
      error: errorMsg,
      route,
      method,
    });

    return result;
  };

  return {
    dispatch,
    createNotification,
    createBatch,
    enqueueAutomationEvent,
    notifyAssetEvent,
    generateTestNotifications,
  };
};

// ---------------------------------------------------------------------------
// Geri uyum (legacy shim) — opsiyonel fonksiyon API'si
// `createNotificationService()` singleton'ını kullanır.
// ---------------------------------------------------------------------------

let defaultService: NotificationService | null = null;

/** Process genelinde tek instance. */
export const getNotificationService = (): NotificationService => {
  if (!defaultService) {
    defaultService = createNotificationService();
  }
  return defaultService;
};
