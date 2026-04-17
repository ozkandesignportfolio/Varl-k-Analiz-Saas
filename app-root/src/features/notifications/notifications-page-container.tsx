"use client";

import { BellPlus, CheckCheck, Funnel } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NotificationsFilters,
  type DateRangeFilter,
  type StatusFilter,
  type TypeFilter,
} from "@/features/notifications/components/NotificationsFilters";
import { NotificationsList } from "@/features/notifications/components/NotificationsList";
import { type NotificationRecord } from "@/features/notifications/data/mock-notifications";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type CreateTestNotificationsResponse = {
  count?: number;
  error?: string;
};

/**
 * Map database Notification to UI NotificationRecord format
 * Logs: NOTIFICATION_MAP for debugging
 */
const mapNotificationToRecord = (notification: Notification): NotificationRecord => {
  console.log("NOTIFICATION_MAP", {
    id: notification?.id,
    type: notification?.type,
    title: notification?.title,
  });

  return {
    id: notification?.id ?? "",
    type: notification?.type ?? "Sistem",
    title: notification?.title ?? "Bildirim",
    description: notification?.message ?? "",
    createdAt: notification?.created_at ?? new Date().toISOString(),
    status: notification?.is_read ? "Okundu" : "Okunmadı",
    source: "automation",
  };
};

export function NotificationsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isGeneratingTestNotifications, setIsGeneratingTestNotifications] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("Tümü");
  const [status, setStatus] = useState<StatusFilter>("Tümü");
  const [dateRange, setDateRange] = useState<DateRangeFilter>(30);
  const [dateRangeAnchorMs, setDateRangeAnchorMs] = useState(() => Date.now());

  // Use the unified notifications hook - single source of truth
  const {
    notifications: rawNotifications,
    isLoading,
    error,
    markAsRead: hookMarkAsRead,
    markAllAsRead: hookMarkAllAsRead,
    deleteNotification: hookDeleteNotification,
    refetch,
  } = useNotifications(currentUserId);

  // Map notifications to UI format (ALWAYS safe — never undefined)
  const notifications = useMemo(() => {
    const safeRaw = rawNotifications ?? [];
    console.log("NOTIFICATION_UI_MAP", {
      rawCount: safeRaw.length,
      userId: currentUserId,
    });
    return safeRaw
      .filter((n): n is Notification => Boolean(n && n.id))
      .map(mapNotificationToRecord);
  }, [rawNotifications, currentUserId]);

  const safeNotifications = notifications ?? [];

  // Debug log
  console.log("notifications:", safeNotifications);

  // Set feedback based on hook state
  useEffect(() => {
    if (error) {
      setFeedback(`Bildirimler yüklenirken hata: ${error}`);
    } else if (!isLoading && safeNotifications.length === 0) {
      setFeedback("Henüz bildirim yok");
    } else {
      setFeedback("");
    }
  }, [error, isLoading, safeNotifications.length]);

  // Load user and set currentUserId
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/notifications");
        return;
      }

      console.log("NOTIFICATION_PAGE_USER", {
        userId: user.id,
        email: user.email,
      });

      setCurrentUserId(user.id);
    };

    void loadUser();
  }, [router, supabase.auth]);

  const onDateRangeChange = (nextRange: DateRangeFilter) => {
    setDateRange(nextRange);
    setDateRangeAnchorMs(Date.now());
  };

  const filteredNotifications = useMemo(() => {
    const thresholdMs = dateRangeAnchorMs - dateRange * 24 * 60 * 60 * 1000;
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return safeNotifications.filter((item) => {
      if (!item) return false;
      const createdTime = new Date(item?.createdAt ?? 0).getTime();
      if (Number.isFinite(createdTime) && createdTime < thresholdMs) {
        return false;
      }

      if (type !== "Tümü" && item?.type !== type) {
        return false;
      }

      if (status !== "Tümü" && item?.status !== status) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = `${item?.title ?? ""} ${item?.description ?? ""} ${item?.detail ?? ""}`.toLocaleLowerCase("tr-TR");
      return searchable.includes(normalizedQuery);
    });
  }, [dateRange, dateRangeAnchorMs, safeNotifications, query, status, type]);

  const unreadCount = useMemo(
    () => safeNotifications.filter((item) => item?.status === "Okunmadı").length,
    [safeNotifications],
  );

  const onMarkRead = async (id: string) => {
    const target = safeNotifications.find((item) => item?.id === id);
    if (!target || target?.status === "Okundu" || !currentUserId) {
      return;
    }

    console.log("NOTIFICATION_MARK_READ_UI", {
      userId: currentUserId,
      notificationId: id,
      status: "attempt",
    });

    const success = await hookMarkAsRead(id);

    if (!success) {
      setFeedback("Bildirim okundu olarak işaretlenemedi.");
      return;
    }

    console.log("NOTIFICATION_MARK_READ_UI", {
      userId: currentUserId,
      notificationId: id,
      status: "success",
    });
  };

  const onDelete = async (id: string) => {
    if (!currentUserId) {
      return;
    }

    console.log("NOTIFICATION_DELETE_UI", {
      userId: currentUserId,
      notificationId: id,
      status: "attempt",
    });

    const success = await hookDeleteNotification(id);

    if (!success) {
      setFeedback("Bildirim silinemedi.");
      return;
    }

    console.log("NOTIFICATION_DELETE_UI", {
      userId: currentUserId,
      notificationId: id,
      status: "success",
    });
  };

  const onMarkAllAsRead = async () => {
    const unreadCount = safeNotifications.filter((item) => item?.status === "Okunmadı").length;

    if (unreadCount === 0 || !currentUserId) {
      return;
    }

    console.log("NOTIFICATION_MARK_ALL_READ_UI", {
      userId: currentUserId,
      unreadCount,
      status: "attempt",
    });

    const markedCount = await hookMarkAllAsRead();

    if (markedCount === 0) {
      setFeedback("Bildirimler okundu olarak işaretlenemedi.");
      return;
    }

    console.log("NOTIFICATION_MARK_ALL_READ_UI", {
      userId: currentUserId,
      markedCount,
      status: "success",
    });
  };

  const onGenerateTestNotifications = async () => {
    if (!currentUserId) {
      return;
    }

    setIsGeneratingTestNotifications(true);
    setFeedback("");

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as CreateTestNotificationsResponse | null;

      if (!response.ok) {
        setFeedback(body?.error ?? "Test bildirimleri oluşturulamadı.");
        return;
      }

      // Refetch notifications after creating test data
      await refetch();
      setFeedback(`${body?.count ?? 4} test bildirimi oluşturuldu.`);
    } catch {
      setFeedback("Test bildirimleri oluşturulamadı.");
    } finally {
      setIsGeneratingTestNotifications(false);
    }
  };

  return (
    <AppShell title="Bildirimler" badge="Bildirim Merkezi">
      <section className="premium-card border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Bildirimler</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Bakım, garanti, belge ve ödeme hatırlatmalarını buradan sade ve anlaşılır bir şekilde takip edin.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onGenerateTestNotifications}
              disabled={isGeneratingTestNotifications || !currentUserId}
              className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20"
            >
              <BellPlus className="h-4 w-4" />
              {isGeneratingTestNotifications ? "Oluşturuluyor..." : "Test Bildirim Oluştur"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onMarkAllAsRead}
              disabled={safeNotifications.length === 0 || unreadCount === 0}
              className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
            >
              <CheckCheck className="h-4 w-4" />
              Tümünü okundu olarak işaretle
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterDialogOpen(true)}
              className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
            >
              <Funnel className="h-4 w-4" />
              Filtreler
            </Button>
          </div>
        </div>
      </section>

      <NotificationsFilters
        query={query}
        type={type}
        status={status}
        dateRange={dateRange}
        onQueryChange={setQuery}
        onTypeChange={setType}
        onStatusChange={setStatus}
        onDateRangeChange={onDateRangeChange}
      />

      {feedback ? (
        <p className="rounded-xl border border-sky-300/25 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {feedback}
        </p>
      ) : null}

      <NotificationsList
        items={filteredNotifications}
        isLoading={isLoading}
        onMarkRead={onMarkRead}
        onDelete={onDelete}
      />

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="border-white/10 bg-[#0f182b] text-white">
          <DialogHeader>
            <DialogTitle>Filtreler</DialogTitle>
            <DialogDescription className="text-slate-300">
              Tür, durum ve tarih filtresiyle listenizi hızlıca daraltın.
            </DialogDescription>
          </DialogHeader>
          <NotificationsFilters
            query={query}
            type={type}
            status={status}
            dateRange={dateRange}
            onQueryChange={setQuery}
            onTypeChange={setType}
            onStatusChange={setStatus}
            onDateRangeChange={onDateRangeChange}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
