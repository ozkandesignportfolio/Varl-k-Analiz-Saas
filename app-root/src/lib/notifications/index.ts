/**
 * NOTIFICATION SYSTEM — PUBLIC API
 * ============================================================================
 * Sadece public API export edilir. Internal katmanlar doğrudan export edilmez.
 * ============================================================================
 */

// Core orchestration (business logic uses these)
export {
  createNotificationService,
  getNotificationService,
  type NotificationService,
  type NotificationType,
  type NotificationResult,
  type NotificationBatchResult,
  type CreateNotificationInput,
  type EnqueueAutomationEventInput,
  type AutomationEnqueueResult,
  type AutomationTriggerType,
  type AssetEventType,
  type NotifyAssetEventInput,
  type NotifyAssetEventResult,
} from "./notification-service";

// Event contract (business logic uses these)
export {
  AppEventType,
  DispatchStage,
  DispatchErrorCode,
  type AppEvent,
  type AssetCreatedEvent,
  type AssetUpdatedEvent,
  type UserWelcomeEvent,
  type TestNotificationEvent,
  type DispatchResult,
  type DispatchSuccess,
  type DispatchFailure,
} from "@/lib/events/app-event";

// Retry worker (cron/operator use)
export { runRetryWorker, manualRepairOrphan } from "@/lib/workers/notification-retry";
