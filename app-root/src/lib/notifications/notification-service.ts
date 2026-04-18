import "server-only";

import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DispatchErrorCode,
  type AppEvent,
  type DispatchResult,
} from "@/lib/events/app-event";
import {
  type CreateNotificationInput,
  type EnqueueAutomationEventInput,
  type AutomationEnqueueResult,
} from "@/lib/db/notification-write.repository";
import { dispatchWithMetrics } from "./dispatch/dispatch-executor";
import {
  createNotification,
  createBatch,
  enqueueAutomationEvent,
} from "./notification-core";
import {
  notifyAssetEvent,
  generateTestNotifications,
} from "./handlers";

/**
 * NOTIFICATION SERVICE — PUBLIC API
 * ============================================================================
 * Orchestration layer. All implementation details moved to:
 *   - notification-dispatcher.ts (dispatch logic)
 *   - /lib/db/* (data access)
 *   - /lib/utils/* (helpers)
 *   - /lib/mappers/* (transforms)
 *   - /lib/observability/* (metrics)
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Public API Types
// ---------------------------------------------------------------------------

export type NotificationType = "Bakım" | "Garanti" | "Belge" | "Ödeme" | "Sistem";

export type NotificationResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code: DispatchErrorCode };

export type NotificationBatchResult = {
  successful: string[];
  eventIds: string[];
  failed: Array<{ error: string; code: DispatchErrorCode }>;
};

export type AutomationTriggerType =
  | "maintenance_7_days"
  | "warranty_30_days"
  | "subscription_due"
  | "service_log_created"
  | "app_event";

export type AssetEventType =
  | import("@/lib/events/app-event").AppEventType.ASSET_CREATED
  | import("@/lib/events/app-event").AppEventType.ASSET_UPDATED;

export type NotifyAssetEventInput = {
  userId: string;
  eventType: AssetEventType;
  assetId: string;
  assetName: string;
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
      code: DispatchErrorCode;
      stage: import("@/lib/events/app-event").DispatchStage;
    };

// Re-export from db layer
export type {
  CreateNotificationInput,
  EnqueueAutomationEventInput,
  AutomationEnqueueResult,
} from "@/lib/db/notification-write.repository";

// ---------------------------------------------------------------------------
// Service Factory
// ---------------------------------------------------------------------------

export type NotificationService = {
  dispatch: (
    event: AppEvent,
    context?: { route?: string; method?: string },
  ) => Promise<DispatchResult>;
  createNotification: (input: CreateNotificationInput) => Promise<NotificationResult>;
  createBatch: (inputs: CreateNotificationInput[]) => Promise<NotificationBatchResult>;
  enqueueAutomationEvent: (
    input: EnqueueAutomationEventInput,
  ) => Promise<AutomationEnqueueResult>;
  notifyAssetEvent: (input: NotifyAssetEventInput) => Promise<NotifyAssetEventResult>;
  generateTestNotifications: (userId: string) => Promise<NotificationBatchResult>;
};

export const createNotificationService = (
  adminClient: SupabaseClient = getSupabaseAdmin(),
): NotificationService => {
  return {
    dispatch: (event, context) => dispatchWithMetrics(adminClient, event, context),
    createNotification: (input) => createNotification(adminClient, input),
    createBatch: (inputs) => createBatch(adminClient, inputs),
    enqueueAutomationEvent: (input) => enqueueAutomationEvent(adminClient, input),
    notifyAssetEvent: (input) => notifyAssetEvent(adminClient, input),
    generateTestNotifications: (userId) => generateTestNotifications(adminClient, userId),
  };
};

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let defaultService: NotificationService | null = null;

/** Process genelinde tek instance. */
export const getNotificationService = (): NotificationService => {
  if (!defaultService) {
    defaultService = createNotificationService();
  }
  return defaultService;
};
