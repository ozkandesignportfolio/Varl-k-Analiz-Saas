"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  mapDashboardSnapshotRpcPayload,
  type DashboardDateRangeDays,
  type DashboardSnapshotResult,
} from "@/features/dashboard/api/dashboard-shared";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RANGE_STORAGE_KEY = "assetly:dashboard-range";

type DashboardRangeContextValue = {
  selectedRange: DashboardDateRangeDays;
  snapshot: DashboardSnapshotResult;
  isSwitching: boolean;
  setRange: (range: DashboardDateRangeDays) => void;
};

const DashboardRangeContext = createContext<DashboardRangeContextValue | null>(null);

export function useDashboardRange(): DashboardRangeContextValue {
  const ctx = useContext(DashboardRangeContext);
  if (!ctx) {
    throw new Error("useDashboardRange must be used inside DashboardRangeProvider");
  }
  return ctx;
}

type DashboardRangeProviderProps = {
  initialRange: DashboardDateRangeDays;
  initialSnapshot: DashboardSnapshotResult;
  userId: string;
  children: ReactNode;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_IN_MS);

async function fetchSnapshotClient(
  userId: string,
  rangeDays: DashboardDateRangeDays,
): Promise<DashboardSnapshotResult> {
  const supabase = createClient();
  const today = startOfToday();
  const from = addDays(today, -(rangeDays - 1));
  const to = addDays(today, 1);

  const rpcClient = supabase as unknown as {
    rpc: (
      fn: "get_dashboard_snapshot",
      args: { p_from: string; p_to: string; p_user_id: string },
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const perfStart = typeof performance !== "undefined" ? performance.now() : 0;

  const { data, error } = await rpcClient.rpc("get_dashboard_snapshot", {
    p_user_id: userId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (process.env.NODE_ENV === "development" && typeof performance !== "undefined") {
    const elapsed = (performance.now() - perfStart).toFixed(1);
    console.log(`[DashboardRange] fetch range=${rangeDays} took ${elapsed}ms`);
  }

  if (error) {
    return {
      data: mapDashboardSnapshotRpcPayload(null),
      isMock: false,
      warning: `Dashboard snapshot RPC hatası: ${error.message}`,
    };
  }

  const payload = Array.isArray(data) ? data[0] : data;
  return {
    data: mapDashboardSnapshotRpcPayload(payload),
    isMock: false,
    warning: null,
  };
}

export const DashboardRangeProvider = memo(function DashboardRangeProvider({
  initialRange,
  initialSnapshot,
  userId,
  children,
}: DashboardRangeProviderProps) {
  const [selectedRange, setSelectedRange] = useState<DashboardDateRangeDays>(initialRange);
  const [snapshot, setSnapshot] = useState<DashboardSnapshotResult>(initialSnapshot);
  const [isSwitching, startTransition] = useTransition();

  // Cache: range → snapshot. Seed with initial server data.
  const cacheRef = useRef<Map<DashboardDateRangeDays, DashboardSnapshotResult>>(
    new Map([[initialRange, initialSnapshot]]),
  );

  const setRange = useCallback(
    (range: DashboardDateRangeDays) => {
      if (range === selectedRange) return;

      if (process.env.NODE_ENV === "development") {
        console.log(`[DashboardRange] switching ${selectedRange} → ${range}`);
      }

      // Persist preference
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RANGE_STORAGE_KEY, String(range));
      }

      // Update URL without triggering server re-render
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("range", String(range));
        window.history.replaceState(null, "", url.toString());
      }

      // Check cache first — instant switch
      const cached = cacheRef.current.get(range);
      if (cached) {
        setSelectedRange(range);
        setSnapshot(cached);
        if (process.env.NODE_ENV === "development") {
          console.log(`[DashboardRange] cache hit for range=${range}`);
        }
        return;
      }

      // Optimistic: update range immediately so UI reflects the selection
      setSelectedRange(range);

      // Fetch in transition so it doesn't block the UI
      startTransition(async () => {
        const result = await fetchSnapshotClient(userId, range);
        cacheRef.current.set(range, result);
        setSnapshot(result);
      });
    },
    [selectedRange, userId],
  );

  const value = useMemo<DashboardRangeContextValue>(
    () => ({ selectedRange, snapshot, isSwitching, setRange }),
    [selectedRange, snapshot, isSwitching, setRange],
  );

  return (
    <DashboardRangeContext.Provider value={value}>
      {children}
    </DashboardRangeContext.Provider>
  );
});
