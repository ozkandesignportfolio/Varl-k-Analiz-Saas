import "server-only";
import type { DbClient, Row } from "@/lib/repos/_shared";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DashboardAssetRow = Pick<Row<"assets">, "id" | "name" | "category" | "warranty_end_date" | "created_at">;
type DashboardRuleRow = Pick<Row<"maintenance_rules">, "id" | "asset_id" | "title" | "next_due_date" | "is_active">;
type DashboardServiceLogRow = Pick<Row<"service_logs">, "id" | "asset_id" | "service_type" | "service_date" | "cost">;

export type DashboardMaintenanceRiskItem = {
  id: string;
  assetId: string;
  assetName: string;
  ruleTitle: string;
  dueDate: string;
  dayCount: number;
};

export type DashboardWarrantyRiskItem = {
  id: string;
  assetId: string;
  assetName: string;
  warrantyEndDate: string;
  daysRemaining: number;
};

export type DashboardServiceTimelineItem = {
  id: string;
  assetId: string;
  assetName: string;
  serviceType: string;
  serviceDate: string;
  cost: number;
};

export type DashboardCostCategory = {
  id: string;
  label: string;
  amount: number;
  color: string;
};

export type DashboardQuickAsset = {
  id: string;
  name: string;
  category: string;
  nextDueDate: string | null;
};

export type DashboardSnapshot = {
  metrics: {
    totalAssets: number;
    activeRules: number;
    totalServiceCost: number;
    documentCount: number;
  };
  riskPanel: {
    overdueMaintenance: DashboardMaintenanceRiskItem[];
    upcomingMaintenance: DashboardMaintenanceRiskItem[];
    upcomingWarranty: DashboardWarrantyRiskItem[];
  };
  recentServices: DashboardServiceTimelineItem[];
  costSummary: {
    total: number;
    categories: DashboardCostCategory[];
  };
  quickAssets: DashboardQuickAsset[];
};

export type DashboardSnapshotResult = {
  data: DashboardSnapshot;
  isMock: boolean;
  warning: string | null;
};

const COST_COLORS = ["#38BDF8", "#F59E0B", "#22C55E", "#A78BFA", "#F97316"];

const parseDate = (value: string) => new Date(value.includes("T") ? value : `${value}T00:00:00`);

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const dayDiff = (date: Date, from: Date) => {
  const diff = date.getTime() - from.getTime();
  return Math.ceil(diff / DAY_IN_MS);
};

const EMPTY_DASHBOARD_DATA: DashboardSnapshot = {
  metrics: {
    totalAssets: 0,
    activeRules: 0,
    totalServiceCost: 0,
    documentCount: 0,
  },
  riskPanel: {
    overdueMaintenance: [],
    upcomingMaintenance: [],
    upcomingWarranty: [],
  },
  recentServices: [],
  costSummary: {
    total: 0,
    categories: [],
  },
  quickAssets: [],
};

const toMaintenanceRisk = (
  rules: DashboardRuleRow[],
  assetsById: Map<string, DashboardAssetRow>,
  today: Date,
) => {
  const overdue: DashboardMaintenanceRiskItem[] = [];
  const upcoming: DashboardMaintenanceRiskItem[] = [];

  for (const rule of rules) {
    if (!rule.is_active) continue;
    const asset = assetsById.get(rule.asset_id);
    if (!asset) continue;

    const dueDate = parseDate(rule.next_due_date);
    const dueInDays = dayDiff(dueDate, today);

    if (dueInDays < 0) {
      overdue.push({
        id: rule.id,
        assetId: asset.id,
        assetName: asset.name,
        ruleTitle: rule.title,
        dueDate: rule.next_due_date,
        dayCount: Math.abs(dueInDays),
      });
      continue;
    }

    if (dueInDays <= 7) {
      upcoming.push({
        id: rule.id,
        assetId: asset.id,
        assetName: asset.name,
        ruleTitle: rule.title,
        dueDate: rule.next_due_date,
        dayCount: dueInDays,
      });
    }
  }

  overdue.sort((a, b) => b.dayCount - a.dayCount);
  upcoming.sort((a, b) => a.dayCount - b.dayCount);

  return {
    overdueMaintenance: overdue.slice(0, 6),
    upcomingMaintenance: upcoming.slice(0, 6),
  };
};

const toWarrantyRisk = (assets: DashboardAssetRow[], today: Date) => {
  const items = assets
    .filter((asset) => !!asset.warranty_end_date)
    .map((asset) => {
      const warrantyEnd = asset.warranty_end_date as string;
      const daysRemaining = dayDiff(parseDate(warrantyEnd), today);
      return {
        id: asset.id,
        assetId: asset.id,
        assetName: asset.name,
        warrantyEndDate: warrantyEnd,
        daysRemaining,
      };
    })
    .filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 6);

  return items;
};

const toRecentServices = (
  serviceLogs: DashboardServiceLogRow[],
  assetsById: Map<string, DashboardAssetRow>,
) =>
  serviceLogs.slice(0, 5).map((log) => ({
    id: log.id,
    assetId: log.asset_id,
    assetName: assetsById.get(log.asset_id)?.name ?? "Bilinmeyen Varlık",
    serviceType: log.service_type,
    serviceDate: log.service_date,
    cost: Number(log.cost ?? 0),
  }));

const toCostSummary = (serviceLogs: DashboardServiceLogRow[]) => {
  const totalsByType = new Map<string, number>();

  for (const log of serviceLogs) {
    const key = (log.service_type || "Diğer").trim() || "Diğer";
    const nextTotal = (totalsByType.get(key) ?? 0) + Number(log.cost ?? 0);
    totalsByType.set(key, nextTotal);
  }

  const categories = [...totalsByType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, amount], index) => ({
      id: `${label}-${index}`,
      label,
      amount,
      color: COST_COLORS[index % COST_COLORS.length],
    }));

  const total = serviceLogs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);

  return {
    total,
    categories,
  };
};

const toQuickAssets = (assets: DashboardAssetRow[], rules: DashboardRuleRow[], today: Date) => {
  const rulesByAsset = new Map<string, string[]>();

  for (const rule of rules) {
    if (!rule.is_active) continue;
    const list = rulesByAsset.get(rule.asset_id) ?? [];
    list.push(rule.next_due_date);
    rulesByAsset.set(rule.asset_id, list);
  }

  return assets.slice(0, 8).map((asset) => {
    const dueDates = (rulesByAsset.get(asset.id) ?? [])
      .map((value) => ({ value, diff: dayDiff(parseDate(value), today) }))
      .sort((a, b) => a.diff - b.diff);

    const nextDueDate = dueDates[0]?.value ?? null;
    return {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      nextDueDate,
    };
  });
};

export async function getDashboardSnapshot(client: DbClient, userId: string): Promise<DashboardSnapshotResult> {
  const [assetRes, ruleRes, serviceRes, documentCountRes] = await Promise.all([
    client
      .from("assets")
      .select("id,name,category,warranty_end_date,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("maintenance_rules")
      .select("id,asset_id,title,next_due_date,is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("next_due_date", { ascending: true }),
    client
      .from("service_logs")
      .select("id,asset_id,service_type,service_date,cost")
      .eq("user_id", userId)
      .order("service_date", { ascending: false })
      .limit(100),
    client.from("documents").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const firstError = assetRes.error ?? ruleRes.error ?? serviceRes.error ?? documentCountRes.error;
  if (firstError) {
    return {
      data: EMPTY_DASHBOARD_DATA,
      isMock: false,
      warning: "Canli veriler alinamadi. Dashboard sifir metriklerle gosteriliyor.",
    };
  }

  const assets = (assetRes.data ?? []) as DashboardAssetRow[];
  const rules = (ruleRes.data ?? []) as DashboardRuleRow[];
  const serviceLogs = (serviceRes.data ?? []) as DashboardServiceLogRow[];
  const documentCount = documentCountRes.count ?? 0;

  const today = startOfToday();
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const maintenanceRisk = toMaintenanceRisk(rules, assetsById, today);
  const warrantyRisk = toWarrantyRisk(assets, today);
  const costSummary = toCostSummary(serviceLogs);

  return {
    data: {
      metrics: {
        totalAssets: assets.length,
        activeRules: rules.length,
        totalServiceCost: costSummary.total,
        documentCount,
      },
      riskPanel: {
        overdueMaintenance: maintenanceRisk.overdueMaintenance,
        upcomingMaintenance: maintenanceRisk.upcomingMaintenance,
        upcomingWarranty: warrantyRisk,
      },
      recentServices: toRecentServices(serviceLogs, assetsById),
      costSummary,
      quickAssets: toQuickAssets(assets, rules, today),
    },
    isMock: false,
    warning: null,
  };
}

