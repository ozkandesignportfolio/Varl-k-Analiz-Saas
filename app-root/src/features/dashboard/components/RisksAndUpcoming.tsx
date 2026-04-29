"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
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
import type { DashboardSnapshot } from "@/features/dashboard/api/dashboard-shared";
import {
  buildRiskAlerts,
  buildUpcomingAlerts,
  buildGroupedAlerts,
  type AlertDecision,
  type AlertGroup,
  type AlertGroupKey,
} from "@/features/dashboard/lib/alert-engine";
import { createClient } from "@/lib/supabase/client";
import { Runtime } from "@/lib/env/runtime";

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
  description: string;
  impact: string;
  dateLabel: string;
  sortDate: string;
  actionHref: string;
  actionLabel: string;
  alertKey: string;
  tone: "critical" | "warning" | "info";
  groupKey: AlertGroupKey;
};

const TONE_LABEL: Record<ListRow["tone"], string> = {
  critical: "Kritik",
  warning: "Uyarı",
  info: "Bilgi",
};

const toneBadgeClass: Record<ListRow["tone"], string> = {
  critical: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  warning: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  info: "border-sky-400/40 bg-sky-500/15 text-sky-200",
};

type UndoState = {
  alertKey: string;
};

const DISMISSED_ALERTS_STORAGE_KEY = "dismissed_alerts";

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

const readDismissedAlertKeys = (): Set<string> => {
  if (!Runtime.isClient()) {
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
  if (!Runtime.isClient()) {
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

  const ICON_MAP: Record<string, LucideIcon> = useMemo(() => ({
    overdue: Wrench,
    warranty: ShieldAlert,
    payment: WalletCards,
    docs: FileWarning,
    "upcoming-maintenance": Timer,
    "upcoming-warranty": ShieldAlert,
    "upcoming-payment": WalletCards,
  }), []);

  const injectIcon = useCallback((row: AlertDecision): ListRow => {
    const prefix = row.id.split("-")[0];
    const secondPrefix = row.id.split("-").slice(0, 2).join("-");
    return { ...row, icon: ICON_MAP[secondPrefix] ?? ICON_MAP[prefix] ?? AlertTriangle };
  }, [ICON_MAP]);

  const riskRows = useMemo<ListRow[]>(
    () => buildRiskAlerts(riskPanel).map(injectIcon),
    [riskPanel, injectIcon],
  );

  const upcomingRows = useMemo<ListRow[]>(
    () => buildUpcomingAlerts(riskPanel).map(injectIcon),
    [riskPanel, injectIcon],
  );

  const shownRiskRows = useMemo(
    () => (showDismissed ? riskRows : riskRows.filter((row) => !dismissedKeys.has(row.alertKey))),
    [dismissedKeys, riskRows, showDismissed],
  );

  const shownUpcomingRows = useMemo(
    () => (showDismissed ? upcomingRows : upcomingRows.filter((row) => !dismissedKeys.has(row.alertKey))),
    [dismissedKeys, upcomingRows, showDismissed],
  );

  const riskGroups = useMemo(
    () => buildGroupedAlerts(shownRiskRows as AlertDecision[]),
    [shownRiskRows],
  );

  const upcomingGroups = useMemo(
    () => buildGroupedAlerts(shownUpcomingRows as AlertDecision[]),
    [shownUpcomingRows],
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
        <GroupedRiskPanel
          title="Öncelikli Riskler"
          groups={riskGroups}
          allRows={shownRiskRows}
          dismissedKeys={dismissedKeys}
          onDismiss={onDismiss}
          settingsAction={{
            href: "/settings?tab=notifications",
            label: "Düzenle",
            icon: Settings,
          }}
          emptyState={{
            icon: ShieldCheck,
            title: "Şu anda dikkat gerektiren bir durum yok",
            description: "Tüm varlıklarınız stabil görünüyor. Varlık ekledikçe burada önemli uyarılar görünecek.",
            href: "/maintenance",
            ctaLabel: "Bakım kuralı oluştur",
          }}
        />

        <GroupedRiskPanel
          title="Yaklaşanlar (7 gün)"
          groups={upcomingGroups}
          allRows={shownUpcomingRows}
          dismissedKeys={dismissedKeys}
          onDismiss={onDismiss}
          emptyState={{
            icon: CalendarClock,
            title: "Önümüzdeki 7 gün için planlı bir iş yok",
            description: "Takvimde yaklaşan bakım, garanti veya ödeme bulunmuyor. Yeni servis kaydı ekleyerek takibi başlatabilirsiniz.",
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

const GROUP_ICON: Record<AlertGroupKey, LucideIcon> = {
  maintenance: Wrench,
  warranty: ShieldAlert,
  payment: WalletCards,
  document: FileWarning,
};

const GroupedRiskPanel = memo(function GroupedRiskPanel({
  title,
  groups,
  allRows,
  dismissedKeys,
  onDismiss,
  emptyState,
  settingsAction,
}: {
  title: string;
  groups: AlertGroup[];
  allRows: ListRow[];
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
  const [expandedGroups, setExpandedGroups] = useState<Set<AlertGroupKey>>(new Set());

  const toggleGroup = useCallback((key: AlertGroupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <article className="rounded-2xl border border-[#2B3F5D] bg-[linear-gradient(150deg,rgba(10,22,44,0.92),rgba(11,18,35,0.84))] p-5 shadow-[0_16px_34px_rgba(2,8,20,0.34)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#345073] bg-[#102643] px-2.5 py-1 text-xs font-semibold text-[#C3D7F4]">
            {allRows.length} kayıt
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

      {allRows.length === 0 ? (
        <EmptyState
          icon={emptyState.icon}
          title={emptyState.title}
          description={emptyState.description}
          href={emptyState.href}
          ctaLabel={emptyState.ctaLabel}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const GroupIcon = GROUP_ICON[group.key];
            const isExpanded = expandedGroups.has(group.key);
            const visibleRows = group.visible as unknown as ListRow[];
            const collapsedRows = group.collapsed as unknown as ListRow[];
            const shownRows = isExpanded ? [...visibleRows, ...collapsedRows] : visibleRows;

            return (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-lg border p-1.5 ${toneClass[group.tone]}`}>
                      <GroupIcon className="size-3.5" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-[#E4EEFF]">{group.label}</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneBadgeClass[group.tone]}`}>
                      {group.totalCount}
                    </span>
                    {group.criticalCount > 0 ? (
                      <span className="text-[10px] font-semibold text-rose-300/80">
                        {group.criticalCount} kritik
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={group.groupActionHref}
                    className="inline-flex items-center rounded-lg border border-[#3C587C] bg-[#143258] px-2.5 py-1 text-[11px] font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
                  >
                    {group.groupActionLabel}
                  </Link>
                </div>

                <div className="space-y-2">
                  {shownRows.map((row) => (
                    <RiskRow
                      key={row.id}
                      row={row}
                      isDismissed={dismissedKeys.has(row.alertKey)}
                      onDismiss={() => onDismiss(row.alertKey)}
                    />
                  ))}
                </div>

                {collapsedRows.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#2B3F5D]/60 bg-[#0A1628]/40 px-3 py-2 text-xs font-semibold text-[#9FB2CE] transition hover:bg-[#0E1E37] hover:text-[#CFE0FA]"
                  >
                    <ChevronDown className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden />
                    {isExpanded
                      ? "Daralt"
                      : `${collapsedRows.length} diğer uyarıyı görüntüle`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
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
    <li className={`rounded-xl border p-3 transition-colors ${toneClass[row.tone]}`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className={`inline-flex shrink-0 rounded-lg border p-2 ${toneClass[row.tone]}`}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneBadgeClass[row.tone]}`}>
                  {TONE_LABEL[row.tone]}
                </span>
                <span className="text-xs text-[#9FB2CE]">{row.dateLabel}</span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug text-[#EAF2FF]">{row.title}</p>
              {isDismissed ? <p className="mt-0.5 text-xs text-[#7FA4D3]">Görmezden gelindi</p> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={row.actionHref}
              className="inline-flex h-fit items-center rounded-lg border border-[#3C587C] bg-[#143258] px-3 py-1.5 text-xs font-semibold text-[#E4EEFF] transition hover:bg-[#1A3E6D]"
            >
              {row.actionLabel}
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

        <div className="space-y-1.5 rounded-lg border border-[#2B3F5D]/60 bg-[#0A1628]/50 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-[#BFD5F5]">{row.description}</p>
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400/70" aria-hidden />
            <p className="text-[11px] leading-relaxed text-amber-200/80">{row.impact}</p>
          </div>
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


