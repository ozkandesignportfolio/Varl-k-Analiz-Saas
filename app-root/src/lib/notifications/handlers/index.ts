/**
 * NOTIFICATION HANDLERS
 * ============================================================================
 * Event-specific handler implementations.
 * Each handler encapsulates logic for a specific event type.
 * ============================================================================
 */

export {
  notifyAssetEvent,
  handleAssetCreated,
  handleAssetUpdated,
} from "./asset-event.handler";

export {
  handleUserWelcome,
} from "./user-welcome.handler";

export {
  generateTestNotifications,
  handleTestNotification,
} from "./test-notification.handler";
