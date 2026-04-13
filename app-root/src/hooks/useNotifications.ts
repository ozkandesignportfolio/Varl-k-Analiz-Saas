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

const HOOK_TAG = "[useNotifications]";

/**
 * Hook to fetch and manage notifications with realtime updates
 * Logs: NOTIFICATION_FETCH, NOTIFICATION_RENDER, realtime events
 */
export function useNotifications(userId: string | null): UseNotificationsReturn {
  console.log("USER_ID_IN_HOOK", userId);

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

    console.log("NOTIFICATION_FETCH", {
      userId,
      fetchId,
      status: "started",
    });

    try {
      const { data, error: supabaseError } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("NOTIF_DATA", data)
      console.log("RAW_RESPONSE", { data, error: supabaseError, count: data?.length ?? 0 });

      if (supabaseError) {
        console.log("NOTIFICATION_FETCH", {
          userId,
          fetchId,
          status: "error",
          error: supabaseError.message,
        });
        setNotifications([]);
        return;
      }

      const notificationsData = data || [];
      
      console.log("NOTIFICATION_FETCH", {
        userId,
        fetchId,
        status: "success",
        count: notificationsData.length,
        unread: notificationsData.filter((n: Notification) => !n.is_read).length,
      });

      setNotifications(notificationsData);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.log("NOTIFICATION_FETCH", {
        userId,
        fetchId,
        status: "exception",
        error: errorMsg,
      });
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

    console.log("NOTIFICATION_REALTIME", {
      userId,
      status: "subscribing",
    });

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
          console.log("NOTIFICATION_REALTIME_INSERT", {
            userId,
            notificationId: payload.new?.id,
            title: payload.new?.title,
          });
          
          // Add new notification to state
          setNotifications((prev) => {
            const newNotification = payload.new as unknown as Notification;
            // Avoid duplicates
            if (prev.some((n: Notification) => n.id === newNotification.id)) {
              return prev;
            }
            return [newNotification, ...prev];
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
          console.log("NOTIFICATION_REALTIME_UPDATE", {
            userId,
            notificationId: payload.new?.id,
            isRead: payload.new?.is_read,
          });
          
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
          console.log("NOTIFICATION_REALTIME_DELETE", {
            userId,
            notificationId: payload.old?.id,
          });
          
          // Remove deleted notification
          setNotifications((prev) =>
            prev.filter((n: Notification) => n.id !== payload.old.id)
          );
        }
      )
      .subscribe((status: string) => {
        console.log("NOTIFICATION_REALTIME", {
          userId,
          status: status === "SUBSCRIBED" ? "subscribed" : status.toLowerCase(),
        });
      });

    channelRef.current = channel;

    return () => {
      console.log("NOTIFICATION_REALTIME", {
        userId,
        status: "unsubscribing",
      });
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabase, userId]);

  // Polling fallback (every 30 seconds)
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      console.log("NOTIFICATION_POLLING", {
        userId,
        status: "triggered",
      });
      void fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, userId]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      console.log("NOTIFICATION_MARK_READ", {
        userId,
        notificationId: id,
        status: "attempt",
      });

      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          console.log("NOTIFICATION_MARK_READ", {
            userId,
            notificationId: id,
            status: "error",
            error: error.message,
          });
          return false;
        }

        console.log("NOTIFICATION_MARK_READ", {
          userId,
          notificationId: id,
          status: "success",
        });

        // Optimistically update UI
        setNotifications((prev) =>
          prev.map((n: Notification) => (n.id === id ? { ...n, is_read: true } : n))
        );

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.log("NOTIFICATION_MARK_READ", {
          userId,
          notificationId: id,
          status: "exception",
          error: errorMsg,
        });
        return false;
      }
    },
    [supabase, userId]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    console.log("NOTIFICATION_MARK_ALL_READ", {
      userId,
      status: "attempt",
    });

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
          console.log("NOTIFICATION_MARK_ALL_READ", {
            userId,
            status: "error",
            error: updateError.message,
          });
          return 0;
        }

        const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;
        
        // Optimistically update UI
        setNotifications((prev) =>
          prev.map((n: Notification) => ({ ...n, is_read: true }))
        );

        console.log("NOTIFICATION_MARK_ALL_READ", {
          userId,
          status: "success",
          count: unreadCount,
        });

        return unreadCount;
      }

      // Optimistically update UI
      setNotifications((prev) =>
        prev.map((n: Notification) => ({ ...n, is_read: true }))
      );

      console.log("NOTIFICATION_MARK_ALL_READ", {
        userId,
        status: "success",
        count,
      });

      return count || 0;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.log("NOTIFICATION_MARK_ALL_READ", {
        userId,
        status: "exception",
        error: errorMsg,
      });
      return 0;
    }
  }, [supabase, userId, notifications]);

  // Delete notification
  const deleteNotification = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      console.log("NOTIFICATION_DELETE", {
        userId,
        notificationId: id,
        status: "attempt",
      });

      try {
        const { error } = await supabase
          .from("notifications")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          console.log("NOTIFICATION_DELETE", {
            userId,
            notificationId: id,
            status: "error",
            error: error.message,
          });
          return false;
        }

        console.log("NOTIFICATION_DELETE", {
          userId,
          notificationId: id,
          status: "success",
        });

        // Optimistically update UI
        setNotifications((prev) => prev.filter((n) => n.id !== id));

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.log("NOTIFICATION_DELETE", {
          userId,
          notificationId: id,
          status: "exception",
          error: errorMsg,
        });
        return false;
      }
    },
    [supabase, userId]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Log render
  useEffect(() => {
    if (!isLoading && userId) {
      console.log("NOTIFICATION_RENDER", {
        userId,
        totalCount: notifications.length,
        unreadCount,
        hasError: !!error,
      });
    }
  }, [notifications.length, unreadCount, error, isLoading, userId]);

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
