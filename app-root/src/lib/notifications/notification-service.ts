import "server-only";

import { randomUUID } from "crypto";
import { logApiError } from "@/lib/api/logging";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppEventType,
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
  | { ok: false; error: string; code?: string };

export type NotificationBatchResult = {
  successful: string[];
  failed: Array<{ error: string; code?: string }>;
};

export type CreateNotificationInput = {
  userId: string;
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
  | "service_log_created";

export type EnqueueAutomationEventInput = {
  userId: string;
  triggerType: AutomationTriggerType;
  dedupeKey: string;
  actions?: Array<"email" | "push" | "sms">;
  assetId?: string | null;
  ruleId?: string | null;
  serviceLogId?: string | null;
  payload?: Record<string, unknown>;
  runAfter?: string;
  context?: { route?: string; method?: string };
};

export type AutomationEnqueueResult =
  | { ok: true; inserted: boolean }
  | { ok: false; error: string; code?: string };

/**
 * Asset bildirimlerini tetikleyen app event kimliği.
 *
 * Servis katında asset-spesifik bir string literal KULLANILMAZ — kimlik yalnızca
 * `AppEventType.ASSET_CREATED` veya `AppEventType.ASSET_UPDATED` olabilir.
 * DB payload'larına da tam olarak bu enum değerleri (`"ASSET_CREATED"` /
 * `"ASSET_UPDATED"`) `payload.event_type` olarak yazılır; paralel bir kelime
 * (örn. `notification_kind: "asset_created"`) üretilmez.
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
  | { ok: true; deduped: false; notificationId: string }
  | { ok: true; deduped: true }
  | { ok: false; error: string; code?: string; stage: "automation" | "notification" };

// ---------------------------------------------------------------------------
// İç yardımcılar
// ---------------------------------------------------------------------------

const SERVICE_TAG = "[notification-service]";

const logEvent = (event: string, payload: Record<string, unknown>) => {
  console.log(`${SERVICE_TAG} ${event}`, payload);
};

const normalizeContext = (ctx?: { route?: string; method?: string }) => ({
  route: ctx?.route?.trim() || "unknown",
  method: ctx?.method?.trim() || "POST",
});

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
    const { userId, title, message, type, source, actionHref, actionLabel } = input;
    const { route, method } = normalizeContext(input.context);

    logEvent("CREATE_ATTEMPT", { userId, title, type, route });

    if (!userId?.trim()) {
      return { ok: false, error: "User ID is required", code: "missing_user_id" };
    }
    if (!title?.trim()) {
      return { ok: false, error: "Title is required", code: "missing_title" };
    }
    if (!message?.trim()) {
      return { ok: false, error: "Message is required", code: "missing_message" };
    }

    try {
      const row: Record<string, unknown> = {
        user_id: userId,
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
          code: error.code,
        };
      }

      if (!data?.id) {
        logEvent("CREATE_FAILED", { userId, error: "No ID returned", route });
        return { ok: false, error: "No ID returned from insert", code: "no_id_returned" };
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
      return { ok: false, error: `Exception: ${errorMsg}`, code: "exception" };
    }
  };

  const createBatch = async (
    inputs: CreateNotificationInput[],
  ): Promise<NotificationBatchResult> => {
    logEvent("BATCH_ATTEMPT", { count: inputs.length });

    const result: NotificationBatchResult = { successful: [], failed: [] };
    for (const input of inputs) {
      const r = await createNotification(input);
      if (r.ok) {
        result.successful.push(r.id);
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
      return { ok: false, error: "User ID is required", code: "missing_user_id" };
    }
    if (!dedupeKey?.trim()) {
      return { ok: false, error: "dedupeKey is required", code: "missing_dedupe_key" };
    }

    const row = {
      user_id: userId,
      asset_id: input.assetId ?? null,
      rule_id: input.ruleId ?? null,
      service_log_id: input.serviceLogId ?? null,
      trigger_type: triggerType,
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
          code: error.code,
        };
      }

      // ignoreDuplicates=true → duplicate ise data boş dizi döner.
      const inserted = Array.isArray(data) && data.length > 0;
      logEvent("AUTOMATION_UPSERT", { userId, dedupeKey, inserted });
      return { ok: true, inserted };
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
      return { ok: false, error: `Exception: ${errorMsg}`, code: "exception" };
    }
  };

  // -------------------------------------------------------------------------
  // notifyAssetEvent — dedupe-aware yüksek seviyeli API
  //   1) Önce automation_events upsert (idempotency anchor).
  //   2) Yeni ise `notifications` insert; duplicate ise atla.
  // -------------------------------------------------------------------------
  const notifyAssetEvent = async (
    input: NotifyAssetEventInput,
  ): Promise<NotifyAssetEventResult> => {
    const { userId, assetId, dedupeKey, eventType } = input;
    const ctx = input.context;

    const assetCategory =
      typeof input.payload?.asset_category === "string"
        ? input.payload.asset_category
        : typeof input.payload?.category === "string"
          ? input.payload.category
          : null;

    // DB payload'ı: event kimliği YALNIZCA `event_type` alanında, AppEventType
    // değerinden türetilir. Paralel bir string marker (notification_kind vs.)
    // yazılmaz.
    const sharedPayload: Record<string, unknown> = {
      asset_name: input.assetName,
      event_type: eventType,
      action_href: `/assets/${assetId}`,
      ...(assetCategory ? { asset_category: assetCategory } : {}),
      ...input.payload,
    };

    // 1) Idempotency: automation_events upsert
    const automation = await enqueueAutomationEvent({
      userId,
      triggerType: "service_log_created",
      dedupeKey: `${dedupeKey}:email`,
      actions: ["email"],
      assetId,
      payload: { ...sharedPayload, email_only: true },
      context: ctx,
    });

    if (!automation.ok) {
      return { ok: false, error: automation.error, code: automation.code, stage: "automation" };
    }

    if (!automation.inserted) {
      // Bu olay için UI bildirimi daha önce üretildi. Duplicate yazmıyoruz.
      logEvent("ASSET_EVENT_DEDUPED", { userId, assetId, dedupeKey, eventType });
      return { ok: true, deduped: true };
    }

    // 2) Yeni event → UI bildirimi oluştur
    const copy = buildAssetUiCopy(eventType, input.assetName);
    const result = await createNotification({
      userId,
      title: copy.title,
      message: copy.message,
      type: "Sistem",
      context: ctx,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, code: result.code, stage: "notification" };
    }

    return { ok: true, deduped: false, notificationId: result.id };
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
        createdAt: new Date(now).toISOString(),
        actionHref: "/assets",
        payload: { event_type: AppEventType.ASSET_UPDATED },
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
    const result: NotificationBatchResult = { successful: [], failed: [] };

    if (!userId?.trim()) {
      result.failed.push({ error: "User ID is required", code: "missing_user_id" });
      return result;
    }

    const drafts = buildTestDrafts();

    for (const draft of drafts) {
      const enqueue = await enqueueAutomationEvent({
        userId,
        triggerType: draft.triggerType,
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
  const dispatch = async (
    event: AppEvent,
    context?: { route?: string; method?: string },
  ): Promise<DispatchResult> => {
    logEvent("DISPATCH_ATTEMPT", { type: event.type, userId: event.userId });

    switch (event.type) {
      case AppEventType.ASSET_CREATED: {
        const result = await notifyAssetEvent({
          userId: event.userId,
          eventType: AppEventType.ASSET_CREATED,
          assetId: event.assetId,
          assetName: event.assetName,
          dedupeKey: `asset-created:${event.assetId}`,
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
          deduped: result.deduped,
          notificationId: result.deduped ? undefined : result.notificationId,
        };
      }

      case AppEventType.ASSET_UPDATED: {
        const result = await notifyAssetEvent({
          userId: event.userId,
          eventType: AppEventType.ASSET_UPDATED,
          assetId: event.assetId,
          assetName: event.assetName,
          dedupeKey: `asset-updated:${event.assetId}:${event.changeVersion}`,
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
          deduped: result.deduped,
          notificationId: result.deduped ? undefined : result.notificationId,
        };
      }

      case AppEventType.USER_WELCOME: {
        const result = await createNotification({
          userId: event.userId,
          title: "Hoş geldiniz",
          message: "Assetly'ye hoş geldiniz! Bildirim sistemi aktif.",
          type: "Sistem",
          source: "system",
          actionHref: "/assets",
          actionLabel: "Varlıklarım",
          context,
        });
        if (!result.ok) {
          return {
            ok: false,
            type: event.type,
            error: result.error,
            code: result.code,
            stage: "notification",
          };
        }
        return { ok: true, type: event.type, notificationId: result.id };
      }

      case AppEventType.TEST_NOTIFICATION: {
        const batch = await generateTestNotifications(event.userId);
        // generateTestNotifications şu an asla top-level throw etmez; hata
        // varsa batch.failed'da toplanır. Kısmi başarı da OK sayılır.
        return {
          ok: true,
          type: event.type,
          successful: batch.successful.length,
          failed: batch.failed.length,
        };
      }

      default:
        return assertNever(event);
    }
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
