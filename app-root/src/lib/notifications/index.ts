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

// Event contract — business logic yalnızca bunları tüketmeli.
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

// Retry worker — orphan repair (production-grade)
export { runRetryWorker, manualRepairOrphan } from "./retry-worker";
