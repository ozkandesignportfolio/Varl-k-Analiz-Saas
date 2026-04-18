/**
 * DB LAYER — PUBLIC EXPORTS
 * ============================================================================
 */

// Write operations
export {
  insertNotification,
  upsertAutomationEvent,
  recordDeadLetter,
  callDispatchAppEvent,
  type CreateNotificationInput,
  type EnqueueAutomationEventInput,
  type AutomationEnqueueResult,
  type NotificationResult,
  type NotificationType,
  type AutomationTriggerType,
  type DispatchAppEventRow,
  type DispatchAppEventParams,
  type DeadLetterInput,
} from "./notification-write.repository";

// Read operations
export {
  getNotificationById,
  type NotificationRow,
} from "./notification-read.repository";
