"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  FileWarning,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Timer,
  WalletCards,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSnapshot } from "@/features/dashboard/api/dashboard-queries";
import { createClient } from "@/lib/supabase/client";

type RisksAndUpcomingProps = {
  userId: string;
  riskPanel: DashboardSnapshot["riskPanel"];
};

type LooseError = {
  message: string;
};

type DismissedAlertRow = {
  alert_key: string;
};

type DismissedAlertsTableQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => Promise<{ data: DismissedAlertRow[] | null; error: LooseError | null }>;
  };
  upsert: (
    values: { user_id: string; alert_key: string },
    options: { onConflict: string },
  ) => Promise<{ error: LooseError | null }>;
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: LooseError | null }>;
    };
  };
};

type DismissedAlertsClient = {
  from: (table: string) => DismissedAlertsTableQuery;
};

type ListRow = {
  id: string;
  icon: LucideIcon;
  title: string;
  dateLabel: string;
  sortDate: string;
  actionHref: string;
  actionLabel?: string;
  alertKey: string;
  tone: "critical" | "warning" | "info";
};

type UndoState = {
  alertKey: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DISMISSED_ALERTS_STORAGE_KEY = "dismissed_alerts";

const formatDate = (value: string) => DATE_FORMATTER.format(new Date(value.includes("T") ? value : `${value}T00:00:00`));

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)} TL`;

const toneClass: Record<ListRow["tone"], string> = {
  critical: "border-rose-300/35 bg-rose-300/10 text-rose-100",
  warning: "border-amber-300/35 bg-amber-300/10 text-amber-100",
  info: "border-sky-300/35 bg-sky-300/10 text-sky-100",
};

const isMissingDismissedAlertsTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("dismissed_alerts") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  );
};

const toAlertKey = (type: string, entityId: string, dueDate: string) => `${type}:${entityId}:${dueDate}`;

const readDismissedAlertKeys = (): Set<string> => {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  const rawValue = window.localStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY);
  if (!rawValue) {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set<string>(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
};

const writeDismissedAlertKeys = (keys: Set<string>) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DISMISSED_ALERTS_STORAGE_KEY, JSON.stringify(Array.from(keys)));
};

export function RisksAndUpcoming({ userId, riskPanel }: RisksAndUpcomingProps) {
  const supabase = useMemo(() => createClient(), []);
  const dismissedAlertsClient = useMemo(() => supabase as unknown as DismissedAlertsClient, [supabase]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => readDismissedAlertKeys());
  const [showDismissed, setShowDismissed] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [canUseSupabaseDismiss, setCanUseSupabaseDismiss] = useState(true);

  const riskRows = useMemo<ListRow[]>(
    () =>
      [
        ...riskPanel.overdueMaintenance.map((item) => ({
          id: `overdue-${item.id}`,
          icon: Wrench,
          title: `${item.assetName} - ${item.ruleTitle}`,
          dateLabel: `${item.dayCount} gün gecikti · ${formatDate(item.dueDate)}`,
          sortDate: item.dueDate,
          actionHref: `/services?asset=${item.assetId}&rule=${item.id}`,
          alertKey: toAlertKey("overdue-maintenance", item.id, item.dueDate),
          tone: "critical" as const,
        })),
        ...riskPanel.upcomingWarranty.map((item) => ({
          id: `warranty-${item.id}`,
          icon: ShieldAlert,
          title: `Garanti bitiyor · ${item.assetName}`,
          dateLabel: `${item.daysRemaining} gün kaldı · ${formatDate(item.warrantyEndDate)}`,
          sortDate: item.warrantyEndDate,
          actionHref: `/assets/${item.assetId}`,
          alertKey: toAlertKey("warranty", item.id, item.warrantyEndDate),
          tone: "warning" as const,
        })),
        ...riskPanel.upcomingPayments.map((item) => ({
          id: `payment-${item.id}`,
          icon: WalletCards,
          title: `Ödeme takibi · ${item.subscriptionName}`,
          dateLabel: `${item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)} gün gecikti` : `${item.daysRemaining} gün kaldı`} · ${formatCurrency(item.totalAmount)} · ${formatDate(item.dueDate)}`,
          sortDate: item.dueDate,
          actionHref: "/invoices",
          alertKey: toAlertKey("payment", item.id, item.dueDate),
          tone: item.daysRemaining < 0 ? ("critical" as const) : ("warning" as const),
        })),
        ...riskPanel.missingDocuments.map((item) => ({
          id: `docs-${item.id}`,
          icon: FileWarning,
          title: `Belge eksiği · ${item.assetName}`,
          dateLabel: `${item.daysWithoutDocument} gündür belge yok · ${formatDate(item.createdAt)}`,
          sortDate: item.createdAt,
          actionHref: `/documents?asset=${item.assetId}`,
          alertKey: toAlertKey("missing-document", item.id, item.createdAt),
          tone: "info" as const,
        })),
      ].slice(0, 10),
    [riskPanel],
  );

  const upcomingRows = useMemo<ListRow[]>(
    () =>
      [
        ...riskPanel.upcomingMaintenance.map((item) => ({
          id: `upcoming-maintenance-${item.id}`,
          icon: Timer,
          title: `${item.assetName} - ${item.ruleTitle}`,
          dateLabel: `${item.dayCount} gün sonra · ${formatDate(item.dueDate)}`,
          sortDate: item.dueDate,
          actionHref: `/services?asset=${item.assetId}&rule=${item.id}`,
          alertKey: toAlertKey("upcoming-maintenance", item.id, item.dueDate),
          tone: "warning" as const,
        })),
        ...riskPanel.upcomingWarranty
          .filter((item) => item.daysRemaining <= 7)
          .map((item) => ({
            id: `upcoming-warranty-${item.id}`,
            icon: ShieldAlert,
            title: `${item.assetName} garantisi bitiyor`,
            dateLabel: `${item.daysRemaining} gün sonra · ${formatDate(item.warrantyEndDate)}`,
            sortDate: item.warrantyEndDate,
            actionHref: `/assets/${item.assetId}`,
            alertKey: toAlertKey("warranty", item.id, item.warrantyEndDate),
            tone: "warning" as const,
          })),
        ...riskPanel.upcomingPayments
          .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 7)
          .map((item) => ({
            id: `upcoming-payment-${item.id}`,
            icon: WalletCards,
            title: `${item.subscriptionName} Ödeme vadesi`,
            dateLabel: `${item.daysRemaining} gün sonra · ${formatDate(item.dueDate)}`,
            sortDate: item.dueDate,
            actionHref: "/invoices",
            alertKey: toAlertKey("payment", item.id, item.dueDate),
            tone: "info" as const,
          })),
      ]
        .sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime())
        .slice(0, 10),
    [riskPanel],
  );

  const shownRiskRows = useMemo(
    () => (showDismissed ? riskRows : riskRows.filter((row) => !dismissedKeys.has(row.alertKey))),
    [dismissedKeys, riskRows, showDismissed],
  );

  const shownUpcomingRows = useMemo(
    () => (showDismissed ? upcomingRows : upcomingRows.filter((row) => !dismissedKeys.has(row.alertKey))),
    [dismissedKeys, upcomingRows, showDismissed],
  );

  useEffect(() => {
    writeDismissedAlertKeys(dismissedKeys);
  }, [dismissedKeys]);

  useEffect(() => {
    let isMounted = true;

    const loadDismissed = async () => {
      if (!isMounted || !userId) {
        return;
      }

      const dismissRes = await dismissedAlertsClient.from("dismissed_alerts").select("alert_key").eq("user_id", userId);

      if (!isMounted) {
        return;
      }

      if (dismissRes.error) {
        if (isMissingDismissedAlertsTableError(dismissRes.error.message)) {
          setCanUseSupabaseDismiss(false);
        }
        return;
      }

      const remoteKeys = (dismissRes.data ?? []).map((row) => row.alert_key);
      if (remoteKeys.length === 0) {
        return;
      }

      setDismissedKeys((prev) => {
        const next = new Set(prev);
        for (const key of remoteKeys) {
          next.add(key);
        }
        return next;
      });
    };

    void loadDismissed();

    return () => {
      isMounted = false;
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, [dismissedAlertsClient, userId]);

  const dismissAlertInSupabase = useCallback(async (alertKey: string) => {
    if (!canUseSupabaseDismiss || !userId) {
      return;
    }

    const upsertRes = await dismissedAlertsClient.from("dismissed_alerts").upsert(
      { user_id: userId, alert_key: alertKey },
      { onConflict: "user_id,alert_key" },
    );

    if (upsertRes.error && isMissingDismissedAlertsTableError(upsertRes.error.message)) {
      setCanUseSupabaseDismiss(false);
    }
  }, [canUseSupabaseDismiss, dismissedAlertsClient, userId]);

  const restoreAlertInSupabase = useCallback(async (alertKey: string) => {
    if (!canUseSupabaseDismiss || !userId) {
      return;
    }

    const deleteRes = await dismissedAlertsClient
      .from("dismissed_alerts")
      .delete()
      .eq("user_id", userId)
      .eq("alert_key", alertKey);

    if (deleteRes.error && isMissingDismissedAlertsTableError(deleteRes.error.message)) {
      setCanUseSupabaseDismiss(false);
    }
  }, [canUseSupabaseDismiss, dismissedAlertsClient, userId]);

  const onDismiss = useCallback((alertKey: string) => {
    setDismissedKeys((prev) => {
      if (prev.has(alertKey)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(alertKey);
      return next;
    });

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    setUndoState({ alertKey });
    undoTimerRef.current = setTimeout(() => {
      setUndoState((prev) => (prev?.alertKey === alertKey ? null : prev));
      undoTimerRef.current = null;
    }, 5000);

    void dismissAlertInSupabase(alertKey);
  }, [dismissAlertInSupabase]);

  const onUndoDismiss = useCallback(() => {
    if (!undoState) {
      return;
    }

    const alertKey = undoState.alertKey;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    setUndoState(null);
    setDismissedKeys((prev) => {
      if (!prev.has(alertKey)) {
        return prev;
      }

      const next = new Set(prev);
      next.delete(alertKey);
      return next;
    });

    void restoreAlertInSupabase(alertKey);
  }, [restoreAlertInSupabase, undoState]);

  const onToggleShowDismissed = useCallback(() => {
    setShowDismissed((prev) => !prev);
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleShowDismissed}
          className="inline-flex items-center rounded-lg border border-[#3C587C] bg-[#102643] px-3 py-1.5 text-xs font-semibold text-[#CFE0FA] transition hover:bg-[#163359]"
        >
          {showDismissed ? "Görmezden gelinenleri gizle" : "Görmezden gelinenleri göster"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskRowsPanel
          title="Öncelikli Riskler"
          rows={shownRiskRows}
          dismissedKeys={dismissedKeys}
          onDismiss={onDismiss}
          settingsAction={{
            href: "/settings?tab=notifications",
            label: "Düzenle",
            icon: Settings,
          }}
          emptyState={{
            icon: ShieldCheck,
            title: "Bugün için risk yok",
            description: "Sistem şu an dengede. Proaktif kalmak için bakım planı oluşturabilirsiniz.",
            href: "/maintenance",
            ctaLabel: "Bakım kuralı oluştur",
          }}
        />

        <RiskRowsPanel
          title="Yaklaşanlar (7 gün)"
          rows={shownUpcomingRows}
          dismissedKeys={dismissedKeys}
          onDismiss={onDismiss}
          emptyState={{
            icon: CalendarClock,
            title: "7 gün içinde yaklaşan iş yok",
            description: "Takvimde acil bir olay görünmüyor. Dilerseniz yeni servis kaydı ekleyebilirsiniz.",
            href: "/services",
            ctaLabel: "Servis kaydı ekle",
          }}
        />
      </div>
      {undoState ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-[#3C587C] bg-[#0E1E37] px-4 py-3 text-sm text-[#EAF2FF] shadow-[0_10px_24px_rgba(2,8,20,0.45)]">
          <span>Uyarı gizlendi</span>
          <button
            type="button"
            onClick={onUndoDismiss}
            className="rounded-md border border-[#4E6D96] bg-[#163359] px-2 py-1 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1D4275]"
          >
            Geri Al
          </button>
        </div>
      ) : null}
    </section>
  );
}

const RiskRowsPanel = memo(function RiskRowsPanel({
  title,
  rows,
  dismissedKeys,
  onDismiss,
  emptyState,
  settingsAction,
}: {
  title: string;
  rows: ListRow[];
  dismissedKeys: Set<string>;
  onDismiss: (alertKey: string) => void;
  emptyState: {
    icon: LucideIcon;
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
  };
  settingsAction?: {
    href: string;
    label: string;
    icon: LucideIcon;
  };
}) {
  const SettingsIcon = settingsAction?.icon;

  return (
    <article className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(150deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#345073] bg-[#102643] px-2.5 py-1 text-xs font-semibold text-[#C3D7F4]">
            {rows.length} kayıt
          </span>
          {settingsAction ? (
            <Link
              href={settingsAction.href}
              className="inline-flex items-center gap-1 rounded-lg border border-[#3C587C] bg-[#143258] px-2.5 py-1.5 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
            >
              {SettingsIcon ? <SettingsIcon className="size-3.5" aria-hidden /> : null}
              {settingsAction.label}
            </Link>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          href={emptyState.href}
          ctaLabel={emptyState.ctaLabel}
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <RiskRow
              key={row.id}
              row={row}
              isDismissed={dismissedKeys.has(row.alertKey)}
              onDismiss={() => onDismiss(row.alertKey)}
            />
          ))}
        </ul>
      )}
    </article>
  );
});

const RiskRow = memo(function RiskRow({
  row,
  isDismissed,
  onDismiss,
}: {
  row: ListRow;
  isDismissed: boolean;
  onDismiss: () => void;
}) {
  const Icon = row.icon;

  return (
    <li className="rounded-xl border border-[#314866] bg-[#0E1E37]/75 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`inline-flex rounded-lg border p-2 ${toneClass[row.tone]}`}>
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#EAF2FF]">{row.title}</p>
            <p className="mt-1 text-xs text-[#9FB2CE]">{row.dateLabel}</p>
            {isDismissed ? <p className="mt-1 text-xs text-[#7FA4D3]">Görmezden gelindi</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={row.actionHref}
            className="inline-flex h-fit items-center rounded-lg border border-[#3C587C] bg-[#143258] px-3 py-1.5 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
          >
            {row.actionLabel ?? "Aksiyon al"}
          </Link>

          <button
            type="button"
            onClick={onDismiss}
            disabled={isDismissed}
            title="Görmezden gel"
            aria-label="Görmezden gel"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-[#3C587C] bg-[#102643] text-[#D7E6FC] transition hover:bg-[#18365B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
});

function EmptyState({
  icon,
  title,
  description,
  href,
  ctaLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  const Icon = icon;

  return (
    <div className="rounded-xl border border-[#314866] bg-[#0E1E37]/75 px-4 py-6 text-center">
      <span className="mx-auto inline-flex rounded-xl border border-[#33506F] bg-[#102643] p-2 text-[#BFD5F5]">
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-[#F8FAFC]">{title}</p>
      <p className="mt-2 text-sm text-[#9FB2CE]">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-lg border border-[#3C587C] bg-[#143258] px-3 py-1.5 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}


