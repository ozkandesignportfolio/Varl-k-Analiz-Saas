"use client";

import { Funnel, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import {
  mockNotifications,
  type NotificationRecord,
  type NotificationStatus,
  type NotificationType,
} from "@/features/notifications/data/mock-notifications";
import { isNotificationMockFallbackEnabled } from "@/features/notifications/utils/mock-fallback";
import { createClient as getSupabaseBrowserClient } from "@/lib/supabase/client";

type LooseError = {
  message: string;
};

type AutomationEventRow = {
  id: string;
  trigger_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
};

type AutomationEventsTableQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      order: (column: string, options: { ascending: boolean }) => {
        limit: (value: number) => Promise<{ data: AutomationEventRow[] | null; error: LooseError | null }>;
      };
    };
  };
};

type LooseSupabaseAutomationClient = {
  from: (table: string) => AutomationEventsTableQuery;
};

const isMissingAutomationEventsTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("automation_events") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
};

const toSafeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return fallback;
};

const resolveTypeFromEvent = (triggerType: string, payload: Record<string, unknown> | null): NotificationType => {
  if (triggerType === "maintenance_7_days") {
    return "Bakım";
  }

  if (triggerType === "warranty_30_days") {
    return "Garanti";
  }

  if (triggerType === "subscription_due" || triggerType === "expense_threshold") {
    return "Ödeme";
  }

  if (toSafeString(payload?.document_type).length > 0) {
    return "Belge";
  }

  return "Sistem";
};

const resolveTitleAndDescription = (
  triggerType: string,
  payload: Record<string, unknown> | null,
): { title: string; description: string } => {
  const assetName = toSafeString(payload?.asset_name, "Varlık");
  const ruleTitle = toSafeString(payload?.rule_title, "Bakım kuralı");
  const warrantyDate = toSafeString(payload?.warranty_end_date, "-");
  const nextDueDate = toSafeString(payload?.next_due_date, "-");
  const serviceType = toSafeString(payload?.service_type, "Servis");
  const subscriptionName = toSafeString(payload?.subscription_name, "Abonelik");
  const providerName = toSafeString(payload?.provider_name, "Sağlayıcı");
  const nextBillingDate = toSafeString(payload?.next_billing_date, "-");

  if (triggerType === "warranty_30_days") {
    return {
      title: "Garanti bitişi yaklaşıyor",
      description: `${assetName} için garanti bitiş tarihi: ${warrantyDate}.`,
    };
  }

  if (triggerType === "maintenance_7_days") {
    return {
      title: "Bakım hatırlatması",
      description: `${assetName} için ${ruleTitle} planının hedef tarihi ${nextDueDate}.`,
    };
  }

  if (triggerType === "subscription_due") {
    return {
      title: "Ödeme günü geldi",
      description: `${providerName} / ${subscriptionName} için tahsilat tarihi ${nextBillingDate}.`,
    };
  }

  if (triggerType === "service_log_created") {
    return {
      title: "Yeni servis kaydı",
      description: `${assetName} için ${serviceType} kaydı başarıyla oluşturuldu.`,
    };
  }

  if (triggerType === "expense_threshold") {
    return {
      title: "Yüksek tutarlı gider uyarısı",
      description: "Tanımlı eşik üzerinde bir gider kaydı algılandı. Kontrol etmeniz önerilir.",
    };
  }

  return {
    title: "Sistem bildirimi",
    description: "Otomasyon akışında yeni bir olay işlendi.",
  };
};

const resolveReadStatusFromEvent = (status: string): NotificationStatus => {
  if (status === "completed") {
    return "Okundu";
  }

  return "Okunmadı";
};

const toNotificationRecord = (row: AutomationEventRow): NotificationRecord => {
  const type = resolveTypeFromEvent(row.trigger_type, row.payload);
  const text = resolveTitleAndDescription(row.trigger_type, row.payload);
  return {
    id: row.id,
    type,
    title: text.title,
    description: text.description,
    createdAt: row.created_at,
    status: resolveReadStatusFromEvent(row.status),
    source: "automation",
  };
};

export function NotificationsPageContainer() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const automationClient = useMemo(
    () => supabase as unknown as LooseSupabaseAutomationClient,
    [supabase],
  );
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("Tümü");
  const [status, setStatus] = useState<StatusFilter>("Tümü");
  const [dateRange, setDateRange] = useState<DateRangeFilter>(30);
  const [dateRangeAnchorMs, setDateRangeAnchorMs] = useState(() => Date.now());

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

      const response = await automationClient
        .from("automation_events")
        .select("id,trigger_type,payload,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (response.error) {
        if (isMissingAutomationEventsTableError(response.error.message)) {
          if (isNotificationMockFallbackEnabled()) {
            setNotifications(mockNotifications);
            setFeedback(
              "Canl? bildirim tablosu bu ortamda bulunamad?. ?nizleme i?in ?rnek bildirim ak??? g?steriliyor.",
            );
          } else {
            setNotifications([]);
            setFeedback(
              "Canl? bildirim tablosu bu ortamda bulunamad? ve mock fallback kapal?. NEXT_PUBLIC_ENABLE_NOTIFICATION_MOCK_FALLBACK=true ile a?abilirsiniz.",
            );
          }
        } else {
          setNotifications([]);
          setFeedback(response.error.message);
        }
        setIsLoading(false);
        return;
      }

      setNotifications((response.data ?? []).map(toNotificationRecord));
      setIsLoading(false);
    };

    void load();
  }, [automationClient, router, supabase.auth]);

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

      const searchable = `${item.title} ${item.description}`.toLocaleLowerCase("tr-TR");
      return searchable.includes(normalizedQuery);
    });
  }, [dateRange, dateRangeAnchorMs, notifications, query, status, type]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.status === "Okunmadı").length,
    [notifications],
  );

  const onMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "Okundu" } : item)),
    );
  };

  const onDelete = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const onMarkAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        status: "Okundu",
      })),
    );
  };

  return (
    <AppShell title="Bildirimler" badge="Bildirim Merkezi">
      <section className="premium-card border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Bildirimler</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Bakım, garanti, belge ve ödeme hatırlatmalarını buradan takip edin.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onMarkAllAsRead}
              disabled={notifications.length === 0 || unreadCount === 0}
              className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
            >
              <CheckCheck className="h-4 w-4" />
              Tümünü Okundu İşaretle
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
              Tür, durum ve tarih filtresiyle listeni hızlıca daralt.
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
