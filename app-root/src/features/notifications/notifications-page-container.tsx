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
import { mapAutomationEventToNotification } from "@/features/notifications/lib/notification-presenter";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseError = {
  message: string;
};

type AutomationEventRow = {
  id: string;
  asset_id: string | null;
  trigger_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

type AutomationEventsResponse = {
  data: AutomationEventRow[] | null;
  error: SupabaseError | null;
};

type MutationResponse = {
  error: SupabaseError | null;
};

type CreateTestNotificationsResponse = {
  count?: number;
  error?: string;
};

type LooseSupabaseAutomationClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (value: number) => Promise<AutomationEventsResponse>;
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<MutationResponse>;
        in: (column: string, values: string[]) => Promise<MutationResponse>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<MutationResponse>;
      };
    };
  };
};

const fetchNotificationsByUserId = async (
  automationClient: LooseSupabaseAutomationClient,
  userId: string,
) =>
  automationClient
    .from("automation_events")
    .select("id,asset_id,trigger_type,payload,status,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

const toNotificationRecord = (row: AutomationEventRow): NotificationRecord | null => {
  if (row.payload && typeof row.payload.email_only === "boolean" && row.payload.email_only) {
    return null;
  }

  return mapAutomationEventToNotification({
    id: row.id,
    assetId: row.asset_id,
    triggerType: row.trigger_type,
    payload: row.payload,
    status: row.status,
    createdAt: row.created_at,
  });
};

export function NotificationsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const automationClient = useMemo(
    () => supabase as unknown as LooseSupabaseAutomationClient,
    [supabase],
  );
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTestNotifications, setIsGeneratingTestNotifications] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("Tümü");
  const [status, setStatus] = useState<StatusFilter>("Tümü");
  const [dateRange, setDateRange] = useState<DateRangeFilter>(30);
  const [dateRangeAnchorMs, setDateRangeAnchorMs] = useState(() => Date.now());

  const loadNotificationsForUser = useCallback(async (userId: string) => {
    setIsLoading(true);

    const response = await fetchNotificationsByUserId(automationClient, userId);

    if (response.error) {
      setNotifications([]);
      setFeedback(`Bildirimler veritabanından alınamadı. ${response.error.message}`);
      setIsLoading(false);
      return false;
    }

    const nextNotifications = (response.data ?? [])
      .map(toNotificationRecord)
      .filter((item): item is NotificationRecord => item !== null);
    setNotifications(nextNotifications);
    setFeedback(nextNotifications.length === 0 ? "Henüz bildiriminiz yok." : "");
    setIsLoading(false);
    return true;
  }, [automationClient]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setFeedback("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/notifications");
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      await loadNotificationsForUser(user.id);
    };

    void load();
  }, [loadNotificationsForUser, router, supabase.auth]);

  const onDateRangeChange = (nextRange: DateRangeFilter) => {
    setDateRange(nextRange);
    setDateRangeAnchorMs(Date.now());
  };

  const filteredNotifications = useMemo(() => {
    const thresholdMs = dateRangeAnchorMs - dateRange * 24 * 60 * 60 * 1000;
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    return notifications.filter((item) => {
      const createdTime = new Date(item.createdAt).getTime();
      if (Number.isFinite(createdTime) && createdTime < thresholdMs) {
        return false;
      }

      if (type !== "Tümü" && item.type !== type) {
        return false;
      }

      if (status !== "Tümü" && item.status !== status) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchable = `${item.title} ${item.description} ${item.detail ?? ""}`.toLocaleLowerCase("tr-TR");
      return searchable.includes(normalizedQuery);
    });
  }, [dateRange, dateRangeAnchorMs, notifications, query, status, type]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.status === "Okunmadı").length,
    [notifications],
  );

  const onMarkRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.status === "Okundu" || !currentUserId) {
      return;
    }

    const response = await automationClient
      .from("automation_events")
      .update({ status: "completed" })
      .eq("user_id", currentUserId)
      .eq("id", id);

    if (response.error) {
      setFeedback(`Bildirim güncellenemedi. ${response.error.message}`);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "Okundu" } : item)),
    );
  };

  const onDelete = async (id: string) => {
    if (!currentUserId) {
      return;
    }

    const response = await automationClient
      .from("automation_events")
      .delete()
      .eq("user_id", currentUserId)
      .eq("id", id);

    if (response.error) {
      setFeedback(`Bildirim silinemedi. ${response.error.message}`);
      return;
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const onMarkAllAsRead = async () => {
    const unreadAutomationIds = notifications
      .filter((item) => item.status === "Okunmadı")
      .map((item) => item.id);

    if (unreadAutomationIds.length === 0 || !currentUserId) {
      return;
    }

    const response = await automationClient
      .from("automation_events")
      .update({ status: "completed" })
      .eq("user_id", currentUserId)
      .in("id", unreadAutomationIds);

    if (response.error) {
      setFeedback(`Bildirimler güncellenemedi. ${response.error.message}`);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        status: "Okundu",
      })),
    );
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

      const didReload = await loadNotificationsForUser(currentUserId);
      if (didReload) {
        setFeedback(`${body?.count ?? 4} test bildirimi oluşturuldu.`);
      }
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
              disabled={notifications.length === 0 || unreadCount === 0}
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
