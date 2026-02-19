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

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const MOCK_TODAY = startOfToday();

export const DASHBOARD_MOCK_DATA: DashboardSnapshot = {
  metrics: {
    totalAssets: 8,
    activeRules: 12,
    totalServiceCost: 4850,
    documentCount: 23,
  },
  riskPanel: {
    overdueMaintenance: [
      {
        id: "mock-overdue-1",
        assetId: "asset-1",
        assetName: "CNC Kesim Makinesi",
        ruleTitle: "Aylık Yağlama Kontrolü",
        dueDate: toIsoDate(addDays(MOCK_TODAY, -12)),
        dayCount: 12,
      },
      {
        id: "mock-overdue-2",
        assetId: "asset-2",
        assetName: "Forklift Linde E20",
        ruleTitle: "250 Saat Hidrolik Bakım",
        dueDate: toIsoDate(addDays(MOCK_TODAY, -6)),
        dayCount: 6,
      },
    ],
    upcomingMaintenance: [
      {
        id: "mock-upcoming-1",
        assetId: "asset-3",
        assetName: "Kompresör Atlas Copco GA11",
        ruleTitle: "Filtre Değişimi",
        dueDate: toIsoDate(addDays(MOCK_TODAY, 2)),
        dayCount: 2,
      },
      {
        id: "mock-upcoming-2",
        assetId: "asset-4",
        assetName: "Jeneratör FG Wilson P33",
        ruleTitle: "Yakıt Sistemi Testi",
        dueDate: toIsoDate(addDays(MOCK_TODAY, 5)),
        dayCount: 5,
      },
    ],
    upcomingWarranty: [
      {
        id: "mock-warranty-1",
        assetId: "asset-5",
        assetName: "Klima Santrali AHU-02",
        warrantyEndDate: toIsoDate(addDays(MOCK_TODAY, 11)),
        daysRemaining: 11,
      },
      {
        id: "mock-warranty-2",
        assetId: "asset-6",
        assetName: "Yangın Paneli Honeywell XLS",
        warrantyEndDate: toIsoDate(addDays(MOCK_TODAY, 24)),
        daysRemaining: 24,
      },
    ],
  },
  recentServices: [
    {
      id: "mock-service-1",
      assetId: "asset-2",
      assetName: "Forklift Linde E20",
      serviceType: "Periyodik Bakım",
      serviceDate: toIsoDate(addDays(MOCK_TODAY, -1)),
      cost: 950,
    },
    {
      id: "mock-service-2",
      assetId: "asset-1",
      assetName: "CNC Kesim Makinesi",
      serviceType: "Acil Onarım",
      serviceDate: toIsoDate(addDays(MOCK_TODAY, -4)),
      cost: 1850,
    },
    {
      id: "mock-service-3",
      assetId: "asset-4",
      assetName: "Jeneratör FG Wilson P33",
      serviceType: "Yedek Parça Değişimi",
      serviceDate: toIsoDate(addDays(MOCK_TODAY, -6)),
      cost: 700,
    },
    {
      id: "mock-service-4",
      assetId: "asset-7",
      assetName: "Soğutma Kulesi CT-20",
      serviceType: "Kalibrasyon",
      serviceDate: toIsoDate(addDays(MOCK_TODAY, -8)),
      cost: 650,
    },
    {
      id: "mock-service-5",
      assetId: "asset-8",
      assetName: "UPS Schneider Galaxy",
      serviceType: "Batarya Testi",
      serviceDate: toIsoDate(addDays(MOCK_TODAY, -12)),
      cost: 700,
    },
  ],
  costSummary: {
    total: 4850,
    categories: [
      { id: "mock-cost-1", label: "Acil Onarım", amount: 2200, color: COST_COLORS[0] },
      { id: "mock-cost-2", label: "Periyodik Bakım", amount: 1600, color: COST_COLORS[1] },
      { id: "mock-cost-3", label: "Yedek Parça", amount: 1050, color: COST_COLORS[2] },
    ],
  },
  quickAssets: [
    { id: "asset-1", name: "CNC Kesim Makinesi", category: "Üretim", nextDueDate: toIsoDate(addDays(MOCK_TODAY, -12)) },
    { id: "asset-2", name: "Forklift Linde E20", category: "Lojistik", nextDueDate: toIsoDate(addDays(MOCK_TODAY, -6)) },
    { id: "asset-3", name: "Kompresör GA11", category: "Mekanik", nextDueDate: toIsoDate(addDays(MOCK_TODAY, 2)) },
    { id: "asset-4", name: "Jeneratör P33", category: "Enerji", nextDueDate: toIsoDate(addDays(MOCK_TODAY, 5)) },
    { id: "asset-5", name: "Klima Santrali AHU-02", category: "HVAC", nextDueDate: toIsoDate(addDays(MOCK_TODAY, 14)) },
    { id: "asset-6", name: "Yangın Paneli XLS", category: "Güvenlik", nextDueDate: toIsoDate(addDays(MOCK_TODAY, 20)) },
    { id: "asset-7", name: "Soğutma Kulesi CT-20", category: "Soğutma", nextDueDate: toIsoDate(addDays(MOCK_TODAY, 27)) },
    { id: "asset-8", name: "UPS Schneider Galaxy", category: "Elektrik", nextDueDate: toIsoDate(addDays(MOCK_TODAY, 30)) },
  ],
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
    categories: categories.length > 0 ? categories : DASHBOARD_MOCK_DATA.costSummary.categories,
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
      data: DASHBOARD_MOCK_DATA,
      isMock: true,
      warning: "Canlı veriler alınamadı. Demo gösterim verileri kullanılıyor.",
    };
  }

  const assets = (assetRes.data ?? []) as DashboardAssetRow[];
  const rules = (ruleRes.data ?? []) as DashboardRuleRow[];
  const serviceLogs = (serviceRes.data ?? []) as DashboardServiceLogRow[];
  const documentCount = documentCountRes.count ?? 0;

  const hasAnyData = assets.length > 0 || rules.length > 0 || serviceLogs.length > 0 || documentCount > 0;
  if (!hasAnyData) {
    return {
      data: DASHBOARD_MOCK_DATA,
      isMock: true,
      warning: null,
    };
  }

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
