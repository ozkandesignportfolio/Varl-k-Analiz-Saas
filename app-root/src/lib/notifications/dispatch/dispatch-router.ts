import "server-only";

import { AppEventType, assertNever, type AppEvent, type DispatchResult } from "@/lib/events/app-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  handleAssetCreated,
  handleAssetUpdated,
  handleUserWelcome,
  handleTestNotification,
} from "../handlers";

/**
 * DISPATCH ROUTER
 * ============================================================================
 * Pure router - only switches on AppEventType and delegates to handlers.
 * NO business logic here - just routing.
 * ============================================================================
 */

export const dispatchRouter = async (
  adminClient: SupabaseClient,
  event: AppEvent,
  context?: { route?: string; method?: string },
): Promise<DispatchResult> => {
  switch (event.type) {
    case AppEventType.ASSET_CREATED:
      return handleAssetCreated(adminClient, event, context);

    case AppEventType.ASSET_UPDATED:
      return handleAssetUpdated(adminClient, event, context);

    case AppEventType.USER_WELCOME:
      return handleUserWelcome(adminClient, event, context);

    case AppEventType.TEST_NOTIFICATION:
      return handleTestNotification(adminClient, event);

    default:
      return assertNever(event);
  }
};
