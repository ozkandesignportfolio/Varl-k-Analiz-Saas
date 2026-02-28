import { NextResponse } from "next/server";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { createEmptyPanelHealthPayload, type PanelHealthPayload } from "@/lib/panel-health";
import { createClient } from "@/lib/supabase/server";

type QueryError = {
  message?: string | null;
};

const PANEL_HEALTH_RPC_MISSING_FN_PATTERN = /Could not find the function public\.compute_panel_health/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown) => (isRecord(value) ? value : null);
const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toString = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
const toNullableString = (value: unknown) => (typeof value === "string" ? value : null);
const toScope = (value: unknown): PanelHealthPayload["scope"] => (value === "public_fallback" ? "public_fallback" : "user");

const normalizePanelHealthPayload = (value: unknown): PanelHealthPayload => {
  const fallback = createEmptyPanelHealthPayload("user");
  const root = asRecord(value);
  if (!root) {
    return fallback;
  }

  const warranty = asRecord(root.warranty);
  const maintenance = asRecord(root.maintenance);
  const documents = asRecord(root.documents);
  const payments = asRecord(root.payments);

  return {
    score: toNumber(root.score, fallback.score),
    ratio: toNumber(root.ratio, fallback.ratio),
    hasNoCost: root.hasNoCost === true,
    assetPrice: toNumber(root.assetPrice, fallback.assetPrice),
    totalCost: toNumber(root.totalCost, fallback.totalCost),
    maintenanceCost: toNumber(root.maintenanceCost, fallback.maintenanceCost),
    expenseCost: toNumber(root.expenseCost, fallback.expenseCost),
    warranty: {
      score: toNumber(warranty?.score, fallback.warranty.score),
      active: toNumber(warranty?.active, fallback.warranty.active),
      expiring: toNumber(warranty?.expiring, fallback.warranty.expiring),
      expired: toNumber(warranty?.expired, fallback.warranty.expired),
      unknown: toNumber(warranty?.unknown, fallback.warranty.unknown),
    },
    maintenance: {
      score: toNumber(maintenance?.score, fallback.maintenance.score),
      planned: toNumber(maintenance?.planned, fallback.maintenance.planned),
      completed: toNumber(maintenance?.completed, fallback.maintenance.completed),
      onTrack: toNumber(maintenance?.onTrack, fallback.maintenance.onTrack),
      overdue: toNumber(maintenance?.overdue, fallback.maintenance.overdue),
    },
    documents: {
      score: toNumber(documents?.score, fallback.documents.score),
      required: toNumber(documents?.required, fallback.documents.required),
      uploaded: toNumber(documents?.uploaded, fallback.documents.uploaded),
      missing: toNumber(documents?.missing, fallback.documents.missing),
    },
    payments: {
      score: toNumber(payments?.score, fallback.payments.score),
      paid: toNumber(payments?.paid, fallback.payments.paid),
      pending: toNumber(payments?.pending, fallback.payments.pending),
      overdue: toNumber(payments?.overdue, fallback.payments.overdue),
      total: toNumber(payments?.total, fallback.payments.total),
    },
    scope: toScope(root.scope),
    warning: toNullableString(root.warning),
    generatedAt: toString(root.generatedAt, new Date().toISOString()),
  };
};

const toPanelHealthWarning = (errorMessage: string) =>
  PANEL_HEALTH_RPC_MISSING_FN_PATTERN.test(errorMessage)
    ? "Panel health RPC fonksiyonu bulunamadi. Supabase migration dosyasini calistirin: 20260228170000_compute_panel_health_rpc.sql."
    : errorMessage;

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
        fn: "compute_panel_health",
        args: { p_user_id: string },
      ) => Promise<{ data: unknown; error: QueryError | null }>;
    };

    const { data, error } = await rpcClient.rpc("compute_panel_health", {
      p_user_id: user.id,
    });

    if (error) {
      throw new Error(toPanelHealthWarning(error.message ?? "Panel saglik RPC cagri hatasi."));
    }

    const payload = normalizePanelHealthPayload(Array.isArray(data) ? data[0] : data);

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const fallback = createEmptyPanelHealthPayload("user");
    fallback.warning = error instanceof Error ? error.message : "Panel saglik verisi hesaplanamadi.";
    return NextResponse.json(fallback, { status: 200 });
  }
}
