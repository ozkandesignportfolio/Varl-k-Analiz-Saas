"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationType } from "@/lib/notifications/notification-service";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
};

export type UseNotificationsReturn = {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<number>;
  deleteNotification: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
};

/**
 * Hook to fetch and manage notifications with realtime updates
 * Logs: NOTIFICATION_FETCH, NOTIFICATION_RENDER, realtime events
 */
export function useNotifications(userId: string | null): UseNotificationsReturn {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchCountRef = useRef(0);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    const fetchId = ++fetchCountRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        setError(supabaseError.message);
        setNotifications([]);
        return;
      }

      const notificationsData = Array.isArray(data)
        ? data.filter((n): n is Notification => Boolean(n && n.id))
        : [];

      setNotifications(notificationsData);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  // Initial fetch
  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    // Cleanup previous channel
    if (channelRef.current) {
      void channelRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          // Add new notification to state (safe)
          setNotifications((prev) => {
            const safePrev = prev ?? [];
            const newNotification = payload?.new as unknown as Notification | undefined;
            if (!newNotification || !newNotification.id) {
              return safePrev;
            }
            // Avoid duplicates
            if (safePrev.some((n: Notification) => n?.id === newNotification.id)) {
              return safePrev;
            }
            return [newNotification, ...safePrev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          // Update existing notification
          setNotifications((prev) =>
            prev.map((n: Notification) =>
              n.id === payload.new.id ? { ...n, ...(payload.new as Partial<Notification>) } : n
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { old: Record<string, unknown> }) => {
          // Remove deleted notification
          setNotifications((prev) =>
            prev.filter((n: Notification) => n.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, userId]);

  // Polling fallback (every 30 seconds)
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, userId]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          return false;
        }

        // Optimistically update UI
        setNotifications((prev) =>
          prev.map((n: Notification) => (n.id === id ? { ...n, is_read: true } : n))
        );

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        void errorMsg;
        return false;
      }
    },
    [supabase, userId]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    try {
      // Use RPC if available, otherwise use update
      const { data: count, error } = await supabase.rpc("mark_all_notifications_read", {
        p_user_id: userId,
      });

      if (error) {
        // Fallback to direct update
        const { error: updateError } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userId)
          .eq("is_read", false);

        if (updateError) {
          return 0;
        }

        const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;
        
        // Optimistically update UI
        setNotifications((prev) =>
          prev.map((n: Notification) => ({ ...n, is_read: true }))
        );

        return unreadCount;
      }

      // Optimistically update UI
      setNotifications((prev) =>
        prev.map((n: Notification) => ({ ...n, is_read: true }))
      );

      return count || 0;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      void errorMsg;
      return 0;
    }
  }, [supabase, userId, notifications]);

  // Delete notification
  const deleteNotification = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const { error } = await supabase
          .from("notifications")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          return false;
        }

        // Optimistically update UI
        setNotifications((prev) => prev.filter((n) => n.id !== id));

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        void errorMsg;
        return false;
      }
    },
    [supabase, userId]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}
