"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  from: (table: string) => RiskActionsTableQuery;
};

type RiskActionState = {
  dismissedAt?: number;
  snoozedUntil?: number;
};

type RiskActionsStore = Record<string, RiskActionState>;

type UseRiskActionsParams = {
  userId: string;
  riskKey: string;
  fixSnoozeDurationMs?: number;
};

type UseRiskActionsResult = {
  isStatusCardVisible: boolean;
  dismissRisk: () => void;
  snoozeRisk: (durationMs: number) => void;
  markRiskFix: () => void;
};

const RISK_ACTIONS_STORAGE_KEY = "assetcare:risk-actions";
const RISK_ACTION_TABLE_CANDIDATES = ["notification_snoozes", "risk_actions"] as const;
const DEFAULT_FIX_SNOOZE_DURATION_MS = 10 * 60 * 1000;

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

export function useRiskActions({
  userId,
  riskKey,
  fixSnoozeDurationMs = DEFAULT_FIX_SNOOZE_DURATION_MS,
}: UseRiskActionsParams): UseRiskActionsResult {
  const supabase = useMemo(() => createClient(), []);
  const riskActionsClient = useMemo(() => supabase as unknown as RiskActionsClient, [supabase]);
  const activeTableRef = useRef<string | null>(null);

  const [riskActionsStore, setRiskActionsStore] = useState<RiskActionsStore>({});
  const [canUseSupabaseRiskActions, setCanUseSupabaseRiskActions] = useState(true);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setRiskActionsStore(readRiskActionsStore());
      setIsHydrated(true);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const riskAction = useMemo(() => {
    if (!isHydrated) {
      return null;
    }

    return riskActionsStore[riskKey] ?? null;
  }, [isHydrated, riskActionsStore, riskKey]);

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
      if (!canUseSupabaseRiskActions || !userId) {
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
    [canUseSupabaseRiskActions, resolveSupabaseTable, riskActionsClient, riskKey, userId],
  );

  const setCurrentRiskAction = useCallback(
    (nextAction: RiskActionState | null) => {
      setRiskActionsStore((current) => {
        const next = { ...current };
        const hasValue =
          !!nextAction &&
          (typeof nextAction.dismissedAt === "number" || typeof nextAction.snoozedUntil === "number");

        if (hasValue) {
          next[riskKey] = {
            dismissedAt: nextAction.dismissedAt,
            snoozedUntil: nextAction.snoozedUntil,
          };
        } else {
          delete next[riskKey];
        }

        return next;
      });

      writeRiskAction(riskKey, nextAction);
    },
    [riskKey],
  );

  useEffect(() => {
    let isMounted = true;

    const loadRiskAction = async () => {
      if (!canUseSupabaseRiskActions || !isMounted || !userId) {
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
    };

    void loadRiskAction();

    return () => {
      isMounted = false;
    };
  }, [canUseSupabaseRiskActions, resolveSupabaseTable, riskActionsClient, riskKey, setCurrentRiskAction, userId]);

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

  const dismissRisk = useCallback(() => {
    const nextAction: RiskActionState = { dismissedAt: Date.now() };
    setCurrentRiskAction(nextAction);
    void persistRiskAction(nextAction);
  }, [persistRiskAction, setCurrentRiskAction]);

  const snoozeRisk = useCallback(
    (durationMs: number) => {
      const nextAction: RiskActionState = { snoozedUntil: Date.now() + durationMs };
      setCurrentRiskAction(nextAction);
      void persistRiskAction(nextAction);
    },
    [persistRiskAction, setCurrentRiskAction],
  );

  const markRiskFix = useCallback(() => {
    const nextAction: RiskActionState = { snoozedUntil: Date.now() + fixSnoozeDurationMs };
    setCurrentRiskAction(nextAction);
    void persistRiskAction(nextAction);
  }, [fixSnoozeDurationMs, persistRiskAction, setCurrentRiskAction]);

  return { isStatusCardVisible, dismissRisk, snoozeRisk, markRiskFix };
}
