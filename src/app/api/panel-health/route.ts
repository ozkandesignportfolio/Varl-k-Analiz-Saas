import { NextResponse } from "next/server";
import { createEmptyPanelHealthPayload, type PanelHealthPayload } from "@/lib/panel-health";
import { computeHealthScore } from "@/lib/scoring/computeHealthScore";
import { createClient } from "@/lib/supabase/server";

type AssetRow = {
  id: string;
  warranty_end_date: string | null;
  created_at: string;
  [key: string]: unknown;
};

type MaintenanceRuleRow = {
  id: string;
  asset_id: string;
  is_active: boolean;
  next_due_date: string;
  last_service_date: string | null;
};

type ServiceLogRow = {
  asset_id: string;
  rule_id: string | null;
  cost: number | null;
};

type ExpenseRow = {
  asset_id: string | null;
  amount: number | null;
  category: string | null;
  note: string | null;
};

type DocumentRow = {
  id: string;
  asset_id: string;
};

type InvoiceRow = {
  status: "pending" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
};

type QueryError = {
  code?: string | null;
  message?: string | null;
};

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
const PRICE_KEYS = ["price", "purchase_price", "asset_price", "current_value", "value"] as const;
const PURCHASE_HINTS = ["satın alma", "satın alma", "purchase", "urun", "ürün", "cihaz", "fiyat", "bedel"];

export const dynamic = "force-dynamic";

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
};

const isMissingTableError = (error: QueryError | null) => {
  if (!error) return false;
  if (MISSING_TABLE_CODES.has(error.code ?? "")) return true;
  const normalized = (error.message ?? "").toLowerCase();
  return normalized.includes("does not exist") && normalized.includes("table");
};

const hasPurchaseHint = (category: string | null, note: string | null) => {
  const normalized = `${category ?? ""} ${note ?? ""}`.toLocaleLowerCase("tr-TR");
  return PURCHASE_HINTS.some((hint) => normalized.includes(hint));
};

const toAssetPrice = (asset: AssetRow, inferredPrice: number) => {
  for (const key of PRICE_KEYS) {
    const value = toPositiveNumber(asset[key]);
    if (value > 0) return value;
  }

  return inferredPrice;
};

const buildSuccessPayload = (payload: Omit<PanelHealthPayload, "generatedAt">): PanelHealthPayload => ({
  ...payload,
  generatedAt: new Date().toISOString(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(createEmptyPanelHealthPayload("public_fallback"), { status: 200 });
  }

  try {
    const [assetsRes, rulesRes, logsRes, docsRes, expensesRes, invoicesRes] = await Promise.all([
      supabase.from("assets").select("*").eq("user_id", user.id),
      supabase.from("maintenance_rules").select("id,asset_id,is_active,next_due_date,last_service_date").eq("user_id", user.id),
      supabase.from("service_logs").select("asset_id,rule_id,cost").eq("user_id", user.id),
      supabase.from("documents").select("id,asset_id").eq("user_id", user.id),
      supabase.from("expenses").select("asset_id,amount,category,note").eq("user_id", user.id),
      supabase.from("billing_invoices").select("status,due_date").eq("user_id", user.id),
    ]);

    if (assetsRes.error) throw assetsRes.error;
    if (rulesRes.error) throw rulesRes.error;
    if (logsRes.error) throw logsRes.error;
    if (docsRes.error) throw docsRes.error;
    if (expensesRes.error && !isMissingTableError(expensesRes.error)) throw expensesRes.error;
    if (invoicesRes.error && !isMissingTableError(invoicesRes.error)) throw invoicesRes.error;

    const assets = (assetsRes.data ?? []) as AssetRow[];
    const rules = ((rulesRes.data ?? []) as MaintenanceRuleRow[]).filter((rule) => rule.is_active);
    const logs = (logsRes.data ?? []) as ServiceLogRow[];
    const documents = (docsRes.data ?? []) as DocumentRow[];
    const expenses = isMissingTableError(expensesRes.error) ? [] : ((expensesRes.data ?? []) as ExpenseRow[]);
    const invoices = isMissingTableError(invoicesRes.error) ? [] : ((invoicesRes.data ?? []) as InvoiceRow[]);

    const maintenanceCost = logs.reduce((sum, log) => sum + toPositiveNumber(log.cost), 0);
    const expenseCost = expenses.reduce((sum, expense) => sum + toPositiveNumber(expense.amount), 0);
    const totalCost = maintenanceCost + expenseCost;

    const inferredPriceByAsset = new Map<string, number>();
    for (const expense of expenses) {
      if (!expense.asset_id) continue;
      const amount = toPositiveNumber(expense.amount);
      if (amount <= 0) continue;

      const current = inferredPriceByAsset.get(expense.asset_id) ?? 0;
      const candidate = hasPurchaseHint(expense.category, expense.note) ? Math.max(current, amount) : current;
      inferredPriceByAsset.set(expense.asset_id, candidate > 0 ? candidate : Math.max(current, amount));
    }

    const assetPrice = assets.reduce((sum, asset) => {
      const inferred = inferredPriceByAsset.get(asset.id) ?? 0;
      return sum + toAssetPrice(asset, inferred);
    }, 0);

    const healthScore = computeHealthScore({
      assetPrice,
      totalCost,
    });

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const inThirtyDays = new Date(startOfToday);
    inThirtyDays.setDate(startOfToday.getDate() + 30);

    let warrantyActive = 0;
    let warrantyExpiring = 0;
    let warrantyExpired = 0;
    let warrantyUnknown = 0;

    for (const asset of assets) {
      const warrantyEnd = parseDateOnly(asset.warranty_end_date);
      if (!warrantyEnd) {
        warrantyUnknown += 1;
        continue;
      }

      if (warrantyEnd < startOfToday) {
        warrantyExpired += 1;
      } else if (warrantyEnd <= inThirtyDays) {
        warrantyExpiring += 1;
      } else {
        warrantyActive += 1;
      }
    }

    const totalAssets = assets.length;
    const warrantyScoreRaw =
      totalAssets <= 0
        ? 100
        : (warrantyActive * 100 + warrantyExpiring * 60 + warrantyExpired * 20 + warrantyUnknown * 40) / totalAssets;
    const warrantyScore = clampScore(warrantyScoreRaw);

    const completedRuleIds = new Set(logs.map((log) => log.rule_id).filter(Boolean));
    const maintenancePlanned = rules.length;
    const maintenanceCompleted = rules.filter(
      (rule) => completedRuleIds.has(rule.id) || parseDateOnly(rule.last_service_date) !== null,
    ).length;
    const maintenanceOnTrack = rules.filter((rule) => {
      const dueDate = parseDateOnly(rule.next_due_date);
      if (!dueDate) return false;
      return dueDate >= startOfToday;
    }).length;
    const maintenanceOverdue = Math.max(0, maintenancePlanned - maintenanceOnTrack);
    const completedRate = maintenancePlanned > 0 ? (maintenanceCompleted / maintenancePlanned) * 100 : 100;
    const onTrackRate = maintenancePlanned > 0 ? (maintenanceOnTrack / maintenancePlanned) * 100 : 100;
    const maintenanceScore = clampScore(completedRate * 0.6 + onTrackRate * 0.4);

    const requiredDocuments = totalAssets;
    const uploadedAssetIds = new Set(documents.map((document) => document.asset_id).filter(Boolean));
    const uploadedDocuments = uploadedAssetIds.size;
    const missingDocuments = Math.max(0, requiredDocuments - uploadedDocuments);
    const documentScore = clampScore(requiredDocuments > 0 ? (uploadedDocuments / requiredDocuments) * 100 : 100);

    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    for (const invoice of invoices) {
      if (invoice.status === "cancelled") continue;
      if (invoice.status === "paid") {
        paidCount += 1;
        continue;
      }

      if (invoice.status === "overdue") {
        overdueCount += 1;
        continue;
      }

      const dueDate = parseDateOnly(invoice.due_date);
      if (dueDate && dueDate < startOfToday) {
        overdueCount += 1;
      } else {
        pendingCount += 1;
      }
    }

    const paymentTotal = paidCount + pendingCount + overdueCount;
    const paymentScore = clampScore(paymentTotal > 0 ? (paidCount * 100 + pendingCount * 50) / paymentTotal : 100);

    const payload = buildSuccessPayload({
      score: healthScore.score,
      ratio: healthScore.ratio,
      hasNoCost: healthScore.hasNoCost,
      assetPrice,
      totalCost,
      maintenanceCost,
      expenseCost,
      warranty: {
        score: warrantyScore,
        active: clampScore(totalAssets > 0 ? (warrantyActive / totalAssets) * 100 : 100),
        expiring: clampScore(totalAssets > 0 ? (warrantyExpiring / totalAssets) * 100 : 0),
        expired: clampScore(totalAssets > 0 ? (warrantyExpired / totalAssets) * 100 : 0),
        unknown: clampScore(totalAssets > 0 ? (warrantyUnknown / totalAssets) * 100 : 0),
      },
      maintenance: {
        score: maintenanceScore,
        planned: maintenancePlanned,
        completed: maintenanceCompleted,
        onTrack: maintenanceOnTrack,
        overdue: maintenanceOverdue,
      },
      documents: {
        score: documentScore,
        required: requiredDocuments,
        uploaded: uploadedDocuments,
        missing: missingDocuments,
      },
      payments: {
        score: paymentScore,
        paid: paidCount,
        pending: pendingCount,
        overdue: overdueCount,
        total: paymentTotal,
      },
      scope: "user",
      warning:
        isMissingTableError(expensesRes.error) || isMissingTableError(invoicesRes.error)
          ? "Bazı opsiyonel tablolar bulunamadı, skor sınırlı veriyle hesaplandı."
          : null,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const fallback = createEmptyPanelHealthPayload("user");
    fallback.warning = error instanceof Error ? error.message : "Panel sağlık verisi hesaplanamadı.";
    return NextResponse.json(fallback, { status: 200 });
  }
}

