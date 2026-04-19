"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { FraudStatsFilters, FraudStatsResponse } from "@/lib/fraud/types";

type UseFraudStatsState = {
  data: FraudStatsResponse | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

const buildQueryString = (filters: FraudStatsFilters) => {
  const params = new URLSearchParams();

  if (filters.email.trim()) {
    params.set("email", filters.email.trim());
  }

  if (filters.ip.trim()) {
    params.set("ip", filters.ip.trim());
  }

  if (filters.eventType !== "all") {
    params.set("eventType", filters.eventType);
  }

  params.set("limit", String(filters.limit));
  params.set("riskMax", String(filters.riskMax));
  params.set("riskMin", String(filters.riskMin));
  params.set("windowHours", String(filters.windowHours));

  return params.toString();
};

export const useFraudStats = (filters: FraudStatsFilters, refreshIntervalMs = 30_000) => {
  const deferredFilters = useDeferredValue(filters);
  const [state, setState] = useState<UseFraudStatsState>({
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
  });

  const queryKey = useMemo(() => buildQueryString(deferredFilters), [deferredFilters]);

  const fetchFraudStats = useCallback(async (reason: "initial" | "poll" | "manual" | "filters") => {
    setState((current) => ({
      ...current,
      error: null,
      isLoading: current.data === null,
      isRefreshing: current.data !== null,
    }));

    try {
      const response = await fetch(`/api/admin/fraud-stats?${queryKey}`, {
        cache: "no-store",
        headers: {
          "x-fraud-refresh-reason": reason,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to fetch fraud stats.");
      }

      const payload = (await response.json()) as FraudStatsResponse;

      startTransition(() => {
        setState({
          data: payload,
          error: null,
          isLoading: false,
          isRefreshing: false,
        });
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Failed to fetch fraud stats.",
        isLoading: false,
        isRefreshing: false,
      }));
    }
  }, [queryKey]);

  useEffect(() => {
    void fetchFraudStats(state.data === null ? "initial" : "filters");
  }, [fetchFraudStats, queryKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchFraudStats("poll");
    }, refreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [fetchFraudStats, queryKey, refreshIntervalMs]);

  return {
    ...state,
    refresh: () => fetchFraudStats("manual"),
  };
};
