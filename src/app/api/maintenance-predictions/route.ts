import { NextResponse } from "next/server";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { fetchWithRetry } from "@/lib/net/fetch-with-timeout";
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import { listForDashboard as listRulesForDashboard } from "@/lib/repos/maintenance-rules-repo";
import { listForPrediction as listServiceLogsForPrediction } from "@/lib/repos/service-logs-repo";
import { requireRouteUser } from "@/lib/supabase/route-auth";

type AssetRow = {
  id: string;
  name: string;
  category: string;
  warranty_end_date: string | null;
};

type RuleRow = {
  asset_id: string;
  next_due_date: string;
  is_active: boolean;
};

type ServiceLogRow = {
  asset_id: string;
  service_date: string;
  service_type: string;
  cost: number;
};

type PredictionItem = {
  assetId: string;
  assetName: string;
  category: string;
  predictedMaintenanceDate: string | null;
  riskScore: number;
  confidence: number;
  basis: string;
  recommendedAction: string;
  serviceLogCount: number;
  averageServiceIntervalDays: number | null;
  lastServiceDate: string | null;
  activeRuleDueDate: string | null;
  overdueDays: number | null;
};

type PredictionResponse = {
  generatedAt: string;
  model: string;
  items: PredictionItem[];
  warning?: string;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const MAX_LOG_ROWS = 800;
const OPENAI_TIMEOUT_MS = 12_000;
const OPENAI_RETRIES = 1;

export const dynamic = "force-dynamic";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseDateOnly = (value: string | null | undefined) => {
  if (!value || !DATE_REGEX.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const toDateInputValue = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const diffDays = (left: Date, right: Date) => {
  const ms = left.getTime() - right.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

const addDays = (source: Date, dayCount: number) => {
  const result = new Date(source);
  result.setUTCDate(result.getUTCDate() + dayCount);
  return result;
};

const buildHeuristicPredictions = ({
  assets,
  rules,
  logs,
  today,
}: {
  assets: AssetRow[];
  rules: RuleRow[];
  logs: ServiceLogRow[];
  today: Date;
}): PredictionItem[] => {
  const logsByAsset = new Map<string, ServiceLogRow[]>();
  for (const log of logs) {
    if (!logsByAsset.has(log.asset_id)) logsByAsset.set(log.asset_id, []);
    logsByAsset.get(log.asset_id)?.push(log);
  }

  const activeRulesByAsset = new Map<string, RuleRow[]>();
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (!activeRulesByAsset.has(rule.asset_id)) activeRulesByAsset.set(rule.asset_id, []);
    activeRulesByAsset.get(rule.asset_id)?.push(rule);
  }

  return assets.map((asset) => {
    const sortedLogDates = (logsByAsset.get(asset.id) ?? [])
      .map((log) => parseDateOnly(log.service_date))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime());

    const serviceLogCount = sortedLogDates.length;
    const lastServiceDateObj = serviceLogCount > 0 ? sortedLogDates[serviceLogCount - 1] : null;
    const lastServiceDate = lastServiceDateObj ? toDateInputValue(lastServiceDateObj) : null;

    const intervalDays: number[] = [];
    for (let i = 1; i < sortedLogDates.length; i += 1) {
      const dayDiff = diffDays(sortedLogDates[i], sortedLogDates[i - 1]);
      if (dayDiff > 0) intervalDays.push(dayDiff);
    }

    const averageServiceIntervalDays =
      intervalDays.length > 0
        ? Math.max(
            1,
            Math.round(intervalDays.reduce((sum, value) => sum + value, 0) / intervalDays.length),
          )
        : null;

    const activeRuleDueDates = (activeRulesByAsset.get(asset.id) ?? [])
      .map((rule) => parseDateOnly(rule.next_due_date))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime());

    const activeRuleDueDateObj = activeRuleDueDates[0] ?? null;
    const activeRuleDueDate = activeRuleDueDateObj ? toDateInputValue(activeRuleDueDateObj) : null;

    let predictedMaintenanceDateObj: Date | null = null;
    if (lastServiceDateObj && averageServiceIntervalDays) {
      predictedMaintenanceDateObj = addDays(lastServiceDateObj, averageServiceIntervalDays);
    } else if (activeRuleDueDateObj) {
      predictedMaintenanceDateObj = activeRuleDueDateObj;
    } else if (lastServiceDateObj) {
      predictedMaintenanceDateObj = addDays(lastServiceDateObj, 180);
    }

    const predictedMaintenanceDate = predictedMaintenanceDateObj
      ? toDateInputValue(predictedMaintenanceDateObj)
      : null;

    const daysUntilPredicted = predictedMaintenanceDateObj
      ? diffDays(predictedMaintenanceDateObj, today)
      : null;

    const overdueDays =
      daysUntilPredicted !== null && daysUntilPredicted < 0 ? Math.abs(daysUntilPredicted) : null;

    let riskScore = 20;
    if (daysUntilPredicted === null) {
      riskScore += 26;
    } else if (daysUntilPredicted < 0) {
      riskScore += 44 + Math.min(20, Math.floor(Math.abs(daysUntilPredicted) / 4));
    } else if (daysUntilPredicted <= 7) {
      riskScore += 34;
    } else if (daysUntilPredicted <= 21) {
      riskScore += 20;
    } else if (daysUntilPredicted <= 45) {
      riskScore += 10;
    } else {
      riskScore += 4;
    }

    if (activeRuleDueDateObj) {
      const daysUntilRule = diffDays(activeRuleDueDateObj, today);
      if (daysUntilRule < 0) {
        riskScore += 17;
      } else if (daysUntilRule <= 7) {
        riskScore += 9;
      }
    }

    if (serviceLogCount === 0) {
      riskScore += 12;
    } else if (serviceLogCount === 1) {
      riskScore += 7;
    }

    const warrantyEnd = parseDateOnly(asset.warranty_end_date);
    if (warrantyEnd) {
      const warrantyDays = diffDays(warrantyEnd, today);
      if (warrantyDays <= 30) {
        riskScore += 5;
      }
    }

    riskScore = clamp(riskScore, 1, 100);

    let confidence = 0.45;
    if (serviceLogCount >= 5) confidence = 0.88;
    else if (serviceLogCount >= 3) confidence = 0.78;
    else if (serviceLogCount === 2) confidence = 0.68;
    else if (serviceLogCount === 1) confidence = 0.58;

    if (!averageServiceIntervalDays && !activeRuleDueDate) confidence -= 0.14;
    confidence = Number(clamp(confidence, 0.3, 0.95).toFixed(2));

    const basisParts: string[] = [];
    if (averageServiceIntervalDays) basisParts.push(`ortalama periyot ${averageServiceIntervalDays} gün`);
    if (lastServiceDate) basisParts.push(`son servis ${lastServiceDate}`);
    if (activeRuleDueDate) basisParts.push(`aktif kural due ${activeRuleDueDate}`);
    if (basisParts.length === 0) basisParts.push("yeterli gecmis veri yok");

    let recommendedAction = "Planlanan tarihe göre izlemeye devam edin.";
    if (riskScore >= 80) recommendedAction = "Bakımi bugün planlayin ve gecikmeyi kapatin.";
    else if (riskScore >= 60) recommendedAction = "7 gün içinde servis randevusu oluşturun.";
    else if (riskScore >= 40) recommendedAction = "Bu ay içinde bir kontrol bakımı planlayın.";

    return {
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      predictedMaintenanceDate,
      riskScore,
      confidence,
      basis: basisParts.join(", "),
      recommendedAction,
      serviceLogCount,
      averageServiceIntervalDays,
      lastServiceDate,
      activeRuleDueDate,
      overdueDays,
    };
  });
};

const extractModelJson = (content: string) => {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(withoutFence) as { items?: unknown };
};

const applyAiOverrides = ({
  baseItems,
  aiPayload,
}: {
  baseItems: PredictionItem[];
  aiPayload: { items?: unknown };
}) => {
  if (!Array.isArray(aiPayload.items)) return baseItems;

  const byAssetId = new Map(baseItems.map((item) => [item.assetId, item]));
  const merged = new Map<string, PredictionItem>();

  for (const rawItem of aiPayload.items) {
    const item = rawItem as Record<string, unknown>;
    const assetId = String(item.assetId ?? "");
    if (!assetId || !byAssetId.has(assetId)) continue;

    const base = byAssetId.get(assetId)!;
    const predictedDateRaw = item.predictedMaintenanceDate;
    const predictedMaintenanceDate =
      typeof predictedDateRaw === "string" && parseDateOnly(predictedDateRaw)
        ? predictedDateRaw
        : predictedDateRaw === null
          ? null
          : base.predictedMaintenanceDate;

    const riskScoreNumber = Number(item.riskScore);
    const confidenceNumber = Number(item.confidence);
    const basis = String(item.basis ?? "").trim();
    const recommendedAction = String(item.recommendedAction ?? "").trim();
    const overdueDays =
      predictedMaintenanceDate && parseDateOnly(predictedMaintenanceDate)
        ? (() => {
            const predictedDate = parseDateOnly(predictedMaintenanceDate)!;
            const now = new Date();
            const utcToday = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
            );
            const days = diffDays(predictedDate, utcToday);
            return days < 0 ? Math.abs(days) : null;
          })()
        : null;

    merged.set(assetId, {
      ...base,
      predictedMaintenanceDate,
      riskScore: Number.isFinite(riskScoreNumber)
        ? Math.round(clamp(riskScoreNumber, 1, 100))
        : base.riskScore,
      confidence: Number.isFinite(confidenceNumber)
        ? Number(clamp(confidenceNumber, 0.3, 0.99).toFixed(2))
        : base.confidence,
      basis: basis || base.basis,
      recommendedAction: recommendedAction || base.recommendedAction,
      overdueDays,
    });
  }

  return baseItems.map((item) => merged.get(item.assetId) ?? item);
};

const runAiScoring = async ({
  openAiKey,
  model,
  baseItems,
}: {
  openAiKey: string;
  model: string;
  baseItems: PredictionItem[];
}) => {
  const aiInput = baseItems.map((item) => ({
    assetId: item.assetId,
    assetName: item.assetName,
    category: item.category,
    serviceLogCount: item.serviceLogCount,
    averageServiceIntervalDays: item.averageServiceIntervalDays,
    lastServiceDate: item.lastServiceDate,
    activeRuleDueDate: item.activeRuleDueDate,
    heuristicPredictedMaintenanceDate: item.predictedMaintenanceDate,
    heuristicRiskScore: item.riskScore,
    heuristicConfidence: item.confidence,
    overdueDays: item.overdueDays,
  }));

  const systemInstruction =
    "You are a maintenance prediction assistant. Return strict JSON only. " +
    "Risk score must be between 1 and 100. confidence must be between 0 and 1. " +
    "predictedMaintenanceDate must be YYYY-MM-DD or null. Keep basis and recommendedAction concise.";

  const userPrompt = {
    today: toDateInputValue(
      new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())),
    ),
    instructions: [
      "Use historical service behavior first, then active rule due date as a constraint.",
      "If historical signals are weak, keep risk slightly higher and confidence lower.",
      "Return all assets in the same output.",
    ],
    schema: {
      items: [
        {
          assetId: "string",
          predictedMaintenanceDate: "YYYY-MM-DD or null",
          riskScore: "number 1-100",
          confidence: "number 0-1",
          basis: "string short reason",
          recommendedAction: "string short recommendation",
        },
      ],
    },
    assets: aiInput,
  };

  const response = await fetchWithRetry(
    OPENAI_CHAT_COMPLETIONS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: JSON.stringify(userPrompt) },
        ],
      }),
    },
    {
      timeoutMs: OPENAI_TIMEOUT_MS,
      retries: OPENAI_RETRIES,
      baseDelayMs: 350,
      maxDelayMs: 1_200,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI model request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI model did not return content.");
  }

  const parsed = extractModelJson(content);
  return applyAiOverrides({ baseItems, aiPayload: parsed });
};

const buildPredictions = async (
  request: Request,
): Promise<PredictionResponse | NextResponse> => {
  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { supabase, user } = auth;

  const rateLimit = enforceRateLimit({
    scope: "api_maintenance_predictions",
    key: `${user.id}:${getRequestIp(request)}`,
    limit: 12,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Cok fazla tahmin istegi gonderildi. Lutfen kisa bir sure sonra tekrar deneyin." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
        },
      },
    );
  }

  const userPlan = getPlanConfigFromProfilePlan(auth.profilePlan);

  if (!userPlan.features.canUseAdvancedAnalytics) {
    return NextResponse.json(
      {
        error: `${userPlan.label} planında gelişmiş analitik tahminleri kapalı. Pro plan ile aktif olur.`,
      },
      { status: 403 },
    );
  }

  const [assetsRes, rulesRes, logsRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id,name,category,warranty_end_date")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      }),
    listRulesForDashboard(supabase, {
      userId: user.id,
      onlyActive: true,
    }),
    listServiceLogsForPrediction(supabase, {
      userId: user.id,
      limit: MAX_LOG_ROWS,
    }),
  ]);

  if (assetsRes.error || rulesRes.error || logsRes.error) {
    const message =
      assetsRes.error?.message ?? rulesRes.error?.message ?? logsRes.error?.message ?? "Query failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const assets = (assetsRes.data ?? []) as AssetRow[];
  const rules = (rulesRes.data ?? []) as RuleRow[];
  const logs = (logsRes.data ?? []) as ServiceLogRow[];

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const baseItems = buildHeuristicPredictions({ assets, rules, logs, today }).sort(
    (a, b) => b.riskScore - a.riskScore,
  );

  const openAiKey = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;

  if (!openAiKey) {
    return {
      generatedAt: new Date().toISOString(),
      model: "heuristic",
      items: baseItems,
    };
  }

  try {
    const aiItems = await runAiScoring({
      openAiKey,
      model: openAiModel,
      baseItems,
    });

    return {
      generatedAt: new Date().toISOString(),
      model: `openai:${openAiModel}`,
      items: aiItems.sort((a, b) => b.riskScore - a.riskScore),
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      model: "heuristic-fallback",
      items: baseItems,
      warning: `AI model hatası, heuristic fallback kullanildi: ${(error as Error).message}`,
    };
  }
};

const handle = async (request: Request) => {
  const result = await buildPredictions(request);
  if (result instanceof NextResponse) return result;
  return NextResponse.json(result, { status: 200 });
};

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}





