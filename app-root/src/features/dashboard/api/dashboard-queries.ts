import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient } from "@/lib/repos/_shared";

// Re-export all shared types and functions so existing import paths keep working.
export {
  DASHBOARD_RANGE_OPTIONS,
  EMPTY_DASHBOARD_DATA,
  mapDashboardSnapshotRpcPayload,
  parseDashboardDateRange,
  type DashboardActivityItem,
  type DashboardActivityType,
  type DashboardDateRangeDays,
  type DashboardKpiTrend,
  type DashboardMaintenanceRiskItem,
  type DashboardMissingDocumentRiskItem,
  type DashboardPaymentRiskItem,
  type DashboardSnapshot,
  type DashboardSnapshotResult,
  type DashboardSystemRisk,
  type DashboardSystemRiskType,
  type DashboardSystemStatus,
  type DashboardSystemTone,
  type DashboardTrendDirection,
  type DashboardWarrantyRiskItem,
} from "@/features/dashboard/api/dashboard-shared";

import {
  EMPTY_DASHBOARD_DATA,
  mapDashboardSnapshotRpcPayload,
  type DashboardDateRangeDays,
  type DashboardSnapshot,
  type DashboardSnapshotResult,
} from "@/features/dashboard/api/dashboard-shared";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DASHBOARD_SNAPSHOT_MISSING_FN_PATTERN = /Could not find the function public\.get_dashboard_snapshot/i;

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_IN_MS);

const toDashboardSnapshotWarning = (error: PostgrestError) => {
  if (DASHBOARD_SNAPSHOT_MISSING_FN_PATTERN.test(error.message)) {
    return "Dashboard snapshot RPC fonksiyonu bulunamadı. Supabase migration dosyalarını sırayla çalıştırın: 20260228150000_dashboard_snapshot_rpc.sql, 20260228155000_dashboard_snapshot_rpc_remove_ambiguous_overload.sql.";
  }
  return `Dashboard snapshot RPC hatası: ${error.message}`;
};

export async function getDashboardSnapshot(
  client: DbClient,
  userId: string,
  options?: { rangeDays?: DashboardDateRangeDays },
): Promise<DashboardSnapshotResult> {
  const rangeDays = options?.rangeDays ?? 30;

  const today = startOfToday();
  const currentPeriodStart = addDays(today, -(rangeDays - 1));
  const tomorrow = addDays(today, 1);

  const rpcClient = client as unknown as {
    rpc: (
      fn: "get_dashboard_snapshot",
      args: { p_from: string; p_to: string; p_user_id: string },
    ) => Promise<{ data: unknown; error: PostgrestError | null }>;
  };

  const { data, error } = await rpcClient.rpc("get_dashboard_snapshot", {
    p_user_id: userId,
    p_from: currentPeriodStart.toISOString(),
    p_to: tomorrow.toISOString(),
  });

  if (error) {
    return {
      data: EMPTY_DASHBOARD_DATA,
      isMock: false,
      warning: toDashboardSnapshotWarning(error),
    };
  }

  const payload = Array.isArray(data) ? data[0] : data;
  const snapshot = mapDashboardSnapshotRpcPayload(payload);

  return {
    data: snapshot,
    isMock: false,
    warning: null,
  };
}
