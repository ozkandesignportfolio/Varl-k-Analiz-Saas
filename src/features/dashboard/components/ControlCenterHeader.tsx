"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Clock3, Plus, ShieldCheck, Wrench, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type DashboardDateRangeDays,
  type DashboardSystemRiskType,
  type DashboardSystemStatus,
} from "@/features/dashboard/api/dashboard-queries";
import { createClient } from "@/lib/supabase/client";

type ControlCenterHeaderProps = {
  selectedRange: DashboardDateRangeDays;
  status: DashboardSystemStatus;
};

type LooseError = {
  message: string;
};

type RiskActionRow = {
  risk_key: string;
  dismissed_at: string | null;
  snoozed_until: string | null;
};

type RiskActionsTableQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ data: RiskActionRow[] | null; error: LooseError | null }>;
    };
  };
  upsert: (
    values: {
      user_id: string;
      risk_key: string;
      dismissed_at: string | null;
      snoozed_until: string | null;
    },
    options: { onConflict: string },
  ) => Promise<{ error: LooseError | null }>;
  delete: () => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => Promise<{ error: LooseError | null }>;
    };
  };
};

type RiskActionsClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  from: (table: string) => RiskActionsTableQuery;
};

type RiskActionState = {
  dismissedAt?: number;
  snoozedUntil?: number;
};

type RiskActionsStore = Record<string, RiskActionState>;

const RISK_ACTIONS_STORAGE_KEY = "assetcare:risk-actions";
const RISK_ACTION_TABLE_CANDIDATES = ["notification_snoozes", "risk_actions"] as const;
const FIX_SNOOZE_DURATION_MS = 10 * 60 * 1000;
const DASHBOARD_RANGE_OPTIONS: DashboardDateRangeDays[] = [7, 30, 90];

const SNOOZE_OPTIONS: { label: string; durationMs: number }[] = [
  { label: "1 saat", durationMs: 60 * 60 * 1000 },
  { label: "1 gün", durationMs: 24 * 60 * 60 * 1000 },
  { label: "1 hafta", durationMs: 7 * 24 * 60 * 60 * 1000 },
];

const RISK_FIX_ROUTES: Record<DashboardSystemRiskType, string> = {
  maintenance_due: "/maintenance",
  rule_missing: "/maintenance",
  document_missing: "/documents",
  invoice_due: "/billing",
  notification_prefs: "/settings",
};

const STATUS_STYLES: Record<
  DashboardSystemStatus["tone"],
  {
    wrapper: string;
    dot: string;
    badge: string;
    iconButton: string;
  }
> = {
  stable: {
    wrapper: "border-[#334155] bg-[#0F172A]/80",
    dot: "bg-slate-400",
    badge: "border-[#334155] bg-[#0B1221] text-[#94A3B8]",
    iconButton: "border-[#334155] bg-[#0B1221] text-[#C3D0E3] hover:bg-[#121C31]",
  },
  healthy: {
    wrapper: "border-emerald-300/35 bg-emerald-300/10",
    dot: "bg-emerald-400",
    badge: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100",
    iconButton: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/20",
  },
  warning: {
    wrapper: "border-amber-300/35 bg-amber-300/10",
    dot: "bg-amber-300",
    badge: "border-amber-300/40 bg-amber-300/10 text-amber-100",
    iconButton: "border-amber-300/40 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20",
  },
  critical: {
    wrapper: "border-rose-300/35 bg-rose-300/12",
    dot: "bg-rose-400",
    badge: "border-rose-300/40 bg-rose-300/10 text-rose-100",
    iconButton: "border-rose-300/40 bg-rose-300/10 text-rose-100 hover:bg-rose-300/20",
  },
};

const isMissingRiskActionsTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  const refersKnownTable = RISK_ACTION_TABLE_CANDIDATES.some((table) => normalized.includes(table));
  return refersKnownTable && (normalized.includes("does not exist") || normalized.includes("schema cache"));
};

const readRiskActionsStore = (): RiskActionsStore => {
  if (typeof window === "undefined") {
    return {};
  }

  const rawValue = window.localStorage.getItem(RISK_ACTIONS_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, RiskActionState] => typeof entry[0] === "string" && !!entry[1] && typeof entry[1] === "object",
    );

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
};

const readRiskAction = (riskKey: string) => readRiskActionsStore()[riskKey] ?? null;

const writeRiskAction = (riskKey: string, value: RiskActionState | null) => {
  if (typeof window === "undefined") {
    return;
  }

  const current = readRiskActionsStore();
  const hasValue = !!value && (typeof value.dismissedAt === "number" || typeof value.snoozedUntil === "number");

  if (hasValue) {
    current[riskKey] = {
      dismissedAt: value.dismissedAt,
      snoozedUntil: value.snoozedUntil,
    };
  } else {
    delete current[riskKey];
  }

  window.localStorage.setItem(RISK_ACTIONS_STORAGE_KEY, JSON.stringify(current));
};

const toTimestamp = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const fromRiskActionRow = (row: RiskActionRow | null | undefined): RiskActionState | null => {
  if (!row) {
    return null;
  }

  const dismissedAt = toTimestamp(row.dismissed_at);
  const snoozedUntil = toTimestamp(row.snoozed_until);

  if (typeof dismissedAt !== "number" && typeof snoozedUntil !== "number") {
    return null;
  }

  return { dismissedAt, snoozedUntil };
};

export function ControlCenterHeader({ selectedRange, status }: ControlCenterHeaderProps) {
  const router = useRouter();
  const style = STATUS_STYLES[status.tone];
  const supabase = useMemo(() => createClient(), []);
  const riskActionsClient = useMemo(() => supabase as unknown as RiskActionsClient, [supabase]);
  const userIdRef = useRef<string | null>(null);
  const activeTableRef = useRef<string | null>(null);

  const risk = status.risk;
  const riskKey = risk.riskKey;

  const [riskActionOverrides, setRiskActionOverrides] = useState<Record<string, RiskActionState | null>>({});
  const [canUseSupabaseRiskActions, setCanUseSupabaseRiskActions] = useState(true);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const riskAction = useMemo(() => {
    const override = riskActionOverrides[riskKey];
    if (typeof override !== "undefined") {
      return override;
    }
    if (!isHydrated) {
      return null;
    }
    return readRiskAction(riskKey);
  }, [isHydrated, riskActionOverrides, riskKey]);

  useEffect(() => {
    const snoozedUntil = riskAction?.snoozedUntil;
    if (typeof snoozedUntil !== "number" || snoozedUntil <= Date.now()) {
      return;
    }

    const timer = setTimeout(() => {
      setNowTs(Date.now());
    }, snoozedUntil - Date.now());

    return () => clearTimeout(timer);
  }, [riskAction?.snoozedUntil]);

  const resolveUserId = useCallback(async () => {
    if (userIdRef.current) {
      return userIdRef.current;
    }

    const {
      data: { user },
    } = await riskActionsClient.auth.getUser();

    userIdRef.current = user?.id ?? null;
    return userIdRef.current;
  }, [riskActionsClient]);

  const resolveSupabaseTable = useCallback(
    async (userId: string) => {
      if (!canUseSupabaseRiskActions) {
        return null;
      }

      if (activeTableRef.current) {
        return activeTableRef.current;
      }

      for (const table of RISK_ACTION_TABLE_CANDIDATES) {
        const probeRes = await riskActionsClient
          .from(table)
          .select("risk_key,dismissed_at,snoozed_until")
          .eq("user_id", userId)
          .eq("risk_key", riskKey);

        if (probeRes.error) {
          if (isMissingRiskActionsTableError(probeRes.error.message)) {
            continue;
          }

          return null;
        }

        activeTableRef.current = table;
        return table;
      }

      setCanUseSupabaseRiskActions(false);
      return null;
    },
    [canUseSupabaseRiskActions, riskActionsClient, riskKey],
  );

  const persistRiskAction = useCallback(
    async (nextAction: RiskActionState | null) => {
      writeRiskAction(riskKey, nextAction);

      if (!canUseSupabaseRiskActions) {
        return;
      }

      const userId = await resolveUserId();
      if (!userId) {
        return;
      }

      const table = await resolveSupabaseTable(userId);
      if (!table) {
        return;
      }

      const hasPersistableValue =
        !!nextAction &&
        (typeof nextAction.dismissedAt === "number" || typeof nextAction.snoozedUntil === "number");

      if (!hasPersistableValue) {
        const deleteRes = await riskActionsClient.from(table).delete().eq("user_id", userId).eq("risk_key", riskKey);

        if (deleteRes.error && isMissingRiskActionsTableError(deleteRes.error.message)) {
          setCanUseSupabaseRiskActions(false);
          activeTableRef.current = null;
        }

        return;
      }

      const upsertRes = await riskActionsClient.from(table).upsert(
        {
          user_id: userId,
          risk_key: riskKey,
          dismissed_at:
            typeof nextAction.dismissedAt === "number" ? new Date(nextAction.dismissedAt).toISOString() : null,
          snoozed_until:
            typeof nextAction.snoozedUntil === "number" ? new Date(nextAction.snoozedUntil).toISOString() : null,
        },
        { onConflict: "user_id,risk_key" },
      );

      if (upsertRes.error && isMissingRiskActionsTableError(upsertRes.error.message)) {
        setCanUseSupabaseRiskActions(false);
        activeTableRef.current = null;
      }
    },
    [canUseSupabaseRiskActions, resolveSupabaseTable, resolveUserId, riskActionsClient, riskKey],
  );

  const setCurrentRiskAction = useCallback(
    (nextAction: RiskActionState | null) => {
      setRiskActionOverrides((current) => ({
        ...current,
        [riskKey]: nextAction,
      }));
    },
    [riskKey],
  );

  useEffect(() => {
    let isMounted = true;

    const loadRiskAction = async () => {
      if (!canUseSupabaseRiskActions) {
        return;
      }

      const userId = await resolveUserId();
      if (!isMounted || !userId) {
        return;
      }

      const table = await resolveSupabaseTable(userId);
      if (!isMounted || !table) {
        return;
      }

      const fetchRes = await riskActionsClient
        .from(table)
        .select("risk_key,dismissed_at,snoozed_until")
        .eq("user_id", userId)
        .eq("risk_key", riskKey);

      if (!isMounted) {
        return;
      }

      if (fetchRes.error) {
        if (isMissingRiskActionsTableError(fetchRes.error.message)) {
          setCanUseSupabaseRiskActions(false);
          activeTableRef.current = null;
        }
        return;
      }

      const remoteAction = fromRiskActionRow(fetchRes.data?.[0]);
      if (!remoteAction) {
        return;
      }

      setCurrentRiskAction(remoteAction);
      writeRiskAction(riskKey, remoteAction);
    };

    void loadRiskAction();

    return () => {
      isMounted = false;
    };
  }, [canUseSupabaseRiskActions, resolveSupabaseTable, resolveUserId, riskActionsClient, riskKey, setCurrentRiskAction]);

  const isStatusCardVisible = useMemo(() => {
    if (!riskAction) {
      return true;
    }

    if (typeof riskAction.dismissedAt === "number") {
      return false;
    }

    if (typeof riskAction.snoozedUntil === "number" && riskAction.snoozedUntil > nowTs) {
      return false;
    }

    return true;
  }, [nowTs, riskAction]);

  const handleDismiss = useCallback(() => {
    const nextAction: RiskActionState = { dismissedAt: Date.now() };
    setCurrentRiskAction(nextAction);
    void persistRiskAction(nextAction);
  }, [persistRiskAction, setCurrentRiskAction]);

  const handleSnooze = useCallback(
    (durationMs: number) => {
      const nextAction: RiskActionState = { snoozedUntil: Date.now() + durationMs };
      setCurrentRiskAction(nextAction);
      void persistRiskAction(nextAction);
    },
    [persistRiskAction, setCurrentRiskAction],
  );

  const handleFix = useCallback(() => {
    const nextAction: RiskActionState = { snoozedUntil: Date.now() + FIX_SNOOZE_DURATION_MS };
    setCurrentRiskAction(nextAction);
    void persistRiskAction(nextAction);

    router.push(RISK_FIX_ROUTES[risk.type]);
  }, [persistRiskAction, risk.type, router, setCurrentRiskAction]);

  return (
    <section className="rounded-3xl border border-[#24344F] bg-[linear-gradient(145deg,rgba(8,20,45,0.92),rgba(9,17,33,0.84))] p-5 shadow-[0_20px_45px_rgba(3,8,20,0.42)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#314B6D] bg-[#0E2039]/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
            <ShieldCheck className="size-3.5 text-emerald-300" aria-hidden />
            Kontrol Merkezi
          </p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">Kontrol Merkezi</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#9FB2CE]">
              Tüm sistemi tek ekrandan yönetin: riskleri izleyin, hızlı aksiyon alın ve kritik alanları takip edin.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#2A3E5F] bg-[#0D1B33]/70 p-1.5">
            <CalendarDays className="mx-1 size-4 text-[#86A3C8]" aria-hidden />
            {DASHBOARD_RANGE_OPTIONS.map((range) => {
              const isActive = selectedRange === range;

              return (
                <Link
                  key={range}
                  href={`/dashboard?range=${range}`}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "border border-[#42608A] bg-[#173155] text-[#EAF2FF]"
                      : "text-[#9CB0CE] hover:bg-[#132A4A] hover:text-[#F1F5F9]"
                  }`}
                >
                  Son {range} gün
                </Link>
              );
            })}
          </div>

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[#2F4569] bg-[#10243F] px-4 py-2 text-sm font-semibold text-[#E2E8F0] transition hover:bg-[#143158]">
              <Plus className="size-4" aria-hidden />
              Hızlı Ekle
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 z-20 mt-2 min-w-52 rounded-xl border border-[#2B3E5B] bg-[#0A162A]/95 p-1.5 shadow-[0_16px_30px_rgba(2,8,20,0.5)] backdrop-blur">
              <HeaderDropdownLink href="/assets" label="Varlık Ekle" />
              <HeaderDropdownLink href="/maintenance" label="Bakım Kuralı Oluştur" />
              <HeaderDropdownLink href="/services" label="Servis Kaydı Ekle" />
              <HeaderDropdownLink href="/documents" label="Belge Yükle" />
            </div>
          </details>
        </div>
      </div>

      {isStatusCardVisible ? (
        <div className={`mt-5 rounded-2xl border p-4 ${style.wrapper}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#90A6C4]">Sistem Durumu</p>
                <h2 className="mt-1 text-lg font-semibold text-[#F8FAFC]">{status.headline}</h2>
                <p className="mt-1 text-sm text-[#CBD5E1]">{status.detail}</p>
              </div>
            </div>

            <TooltipProvider>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex h-fit rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
                  {status.riskCount} aktif kayıt
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className={`inline-flex size-7 items-center justify-center rounded-md border transition ${style.iconButton}`}
                      aria-label="Görmezden gel"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Görmezden gel</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`inline-flex size-7 items-center justify-center rounded-md border transition ${style.iconButton}`}
                          aria-label="Sonra hatırlat"
                        >
                          <Clock3 className="size-3.5" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Sonra hatırlat</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent
                    align="end"
                    className="w-40 border-[#2F4569] bg-[#0D1F39]/95 text-[#E5EEFC] shadow-[0_14px_30px_rgba(2,8,20,0.5)]"
                  >
                    <DropdownMenuLabel className="text-xs uppercase tracking-[0.14em] text-[#9BB0CD]">
                      Sonra hatırlat
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-[#314B6D]" />
                    {SNOOZE_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.label}
                        onSelect={() => handleSnooze(option.durationMs)}
                        className="cursor-pointer rounded-md text-sm text-[#E5EEFC] focus:bg-[#17345D] focus:text-white"
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleFix}
                      className={`inline-flex size-7 items-center justify-center rounded-md border transition ${style.iconButton}`}
                      aria-label="Düzelt"
                    >
                      <Wrench className="size-3.5" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Düzelt</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HeaderDropdownLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-sm text-[#D7E3F7] transition hover:border-[#3A557A] hover:bg-[#122643]"
    >
      <span>{label}</span>
      <span className="text-xs text-[#8FA6C7]">Git</span>
    </Link>
  );
}
