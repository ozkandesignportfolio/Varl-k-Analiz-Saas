import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NOTIFICATION READ REPOSITORY
 * ============================================================================
 * All read operations for notification system.
 * Currently no direct reads in notification service (all via RPC/views).
 * Reserved for future query operations.
 * ============================================================================
 */

// Placeholder for future read operations
// Example: getNotificationsByUser, getUnreadCount, etc.

export type NotificationRow = {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export const getNotificationById = async (
  adminClient: SupabaseClient,
  notificationId: string,
): Promise<NotificationRow | null> => {
  const { data, error } = await adminClient
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (error || !data) return null;
  return data as NotificationRow;
};
