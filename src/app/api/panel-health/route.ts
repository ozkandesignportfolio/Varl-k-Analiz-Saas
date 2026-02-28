import { NextResponse } from "next/server";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { createEmptyPanelHealthPayload, type PanelHealthPayload } from "@/lib/panel-health";
import { computeHealthScore } from "@/lib/scoring/computeHealthScore";
import { createClient } from "@/lib/supabase/server";

type QueryError = {
  message?: string | null;
};

type PanelHealthAggregateRow = {
  asset_price: number | string | null;
  maintenance_cost: number | string | null;
  expense_cost: number | string | null;
  total_assets: number | string | null;
  warranty_active: number | string | null;
  warranty_expiring: number | string | null;
  warranty_expired: number | string | null;
  warranty_unknown: number | string | null;
  maintenance_planned: number | string | null;
  maintenance_completed: number | string | null;
  maintenance_on_track: number | string | null;
  uploaded_assets: number | string | null;
  paid_count: number | string | null;
  pending_count: number | string | null;
  overdue_count: number | string | null;
  expenses_table_missing: boolean | null;
  invoices_table_missing: boolean | null;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInteger = (value: number | string | null | undefined) => {
  const parsed = Math.round(toNumber(value));
  return parsed > 0 ? parsed : 0;
};

const buildSuccessPayload = (payload: Omit<PanelHealthPayload, "generatedAt">): PanelHealthPayload => ({
  ...payload,
  generatedAt: new Date().toISOString(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(createEmptyPanelHealthPayload("public_fallback"), { status: 200 });
  }

  const rateLimit = enforceRateLimit({
    scope: "api_panel_health",
    key: `${user.id}:${getRequestIp(request)}`,
    limit: 45,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Panel saglik istegi limiti asildi. Lutfen kisa bir sure sonra tekrar deneyin." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
        },
      },
    );
  }

  try {
    const rpcClient = supabase as unknown as {
      rpc: (
        fn: "get_panel_health_aggregates",
        args: { p_user_id: string },
      ) => Promise<{ data: unknown; error: QueryError | null }>;
    };

    const { data, error } = await rpcClient.rpc("get_panel_health_aggregates", {
      p_user_id: user.id,
    });

    if (error) {
      throw new Error(error.message ?? "Panel saglik aggregate RPC cagri hatasi.");
    }

    const rows = Array.isArray(data) ? (data as PanelHealthAggregateRow[]) : [];
    const row = rows[0];

    if (!row) {
      return NextResponse.json(createEmptyPanelHealthPayload("user"), { status: 200 });
    }

    const assetPrice = Math.max(0, toNumber(row.asset_price));
    const maintenanceCost = Math.max(0, toNumber(row.maintenance_cost));
    const expenseCost = Math.max(0, toNumber(row.expense_cost));
    const totalCost = maintenanceCost + expenseCost;

    const healthScore = computeHealthScore({
      assetPrice,
      totalCost,
    });

    const totalAssets = toInteger(row.total_assets);
    const warrantyActive = toInteger(row.warranty_active);
    const warrantyExpiring = toInteger(row.warranty_expiring);
    const warrantyExpired = toInteger(row.warranty_expired);
    const warrantyUnknown = toInteger(row.warranty_unknown);
    const warrantyScoreRaw =
      totalAssets <= 0
        ? 100
        : (warrantyActive * 100 + warrantyExpiring * 60 + warrantyExpired * 20 + warrantyUnknown * 40) / totalAssets;
    const warrantyScore = clampScore(warrantyScoreRaw);

    const maintenancePlanned = toInteger(row.maintenance_planned);
    const maintenanceCompleted = toInteger(row.maintenance_completed);
    const maintenanceOnTrack = toInteger(row.maintenance_on_track);
    const maintenanceOverdue = Math.max(0, maintenancePlanned - maintenanceOnTrack);
    const completedRate = maintenancePlanned > 0 ? (maintenanceCompleted / maintenancePlanned) * 100 : 100;
    const onTrackRate = maintenancePlanned > 0 ? (maintenanceOnTrack / maintenancePlanned) * 100 : 100;
    const maintenanceScore = clampScore(completedRate * 0.6 + onTrackRate * 0.4);

    const requiredDocuments = totalAssets;
    const uploadedDocuments = toInteger(row.uploaded_assets);
    const missingDocuments = Math.max(0, requiredDocuments - uploadedDocuments);
    const documentScore = clampScore(requiredDocuments > 0 ? (uploadedDocuments / requiredDocuments) * 100 : 100);

    const paidCount = toInteger(row.paid_count);
    const pendingCount = toInteger(row.pending_count);
    const overdueCount = toInteger(row.overdue_count);
    const paymentTotal = paidCount + pendingCount + overdueCount;
    const paymentScore = clampScore(paymentTotal > 0 ? (paidCount * 100 + pendingCount * 50) / paymentTotal : 100);

    const warning =
      row.expenses_table_missing || row.invoices_table_missing
        ? "Bazi opsiyonel tablolar bulunamadi, skor sinirli veriyle hesaplandi."
        : null;

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
      warning,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const fallback = createEmptyPanelHealthPayload("user");
    fallback.warning = error instanceof Error ? error.message : "Panel saglik verisi hesaplanamadi.";
    return NextResponse.json(fallback, { status: 200 });
  }
}
