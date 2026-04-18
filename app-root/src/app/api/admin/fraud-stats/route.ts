import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logApiError, logApiRequest } from "@/lib/api/logging";
import { requireAdminRouteAccess } from "@/lib/auth/admin-access";
import { getRiskSnapshot } from "@/lib/fraud/risk-store";
import type {
  FraudAttempt,
  FraudDashboardEventType,
  FraudMetricSummary,
  FraudOutcomePoint,
  FraudRankedEntity,
  FraudRiskDistributionPoint,
  FraudStatsFilters,
  FraudStatsResponse,
  FraudVolumePoint,
} from "@/lib/fraud/types";
import { getSupabaseAdmin } from "@/lib/services/supabase-admin";
import type { SignupRiskLevel } from "@/lib/supabase/signup";

export const dynamic = "force-dynamic";

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type AuthSecurityLogRow = {
  created_at: string;
  email: string | null;
  event_type: string;
  id: string;
  ip: string | null;
  metadata: Json;
  user_agent: string | null;
  user_id: string | null;
};

type UserConsentRow = {
  consented_at: string;
  user_id: string;
};

const MAX_LIMIT = 250;
const DEFAULT_LIMIT = 120;
const DEFAULT_WINDOW_HOURS = 24 * 7;
const HIGH_RISK_THRESHOLD = 60;
const RISK_BUCKETS = [
  { label: "0-19", max: 19, min: 0 },
  { label: "20-39", max: 39, min: 20 },
  { label: "40-59", max: 59, min: 40 },
  { label: "60-79", max: 79, min: 60 },
  { label: "80-100", max: 100, min: 80 },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Math.floor(toNumber(value, fallback));
  return Math.min(max, Math.max(min, parsed));
};

const toRiskLevel = (score: number): SignupRiskLevel => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
};

const normalizeEmail = (value: string | null) => value?.trim().toLowerCase() || null;

const parseFilters = (request: Request): FraudStatsFilters => {
  const url = new URL(request.url);

  return {
    email: url.searchParams.get("email")?.trim() || "",
    eventType: (url.searchParams.get("eventType")?.trim() || "all") as FraudStatsFilters["eventType"],
    ip: url.searchParams.get("ip")?.trim() || "",
    limit: toInteger(url.searchParams.get("limit"), DEFAULT_LIMIT, 20, MAX_LIMIT),
    riskMax: toInteger(url.searchParams.get("riskMax"), 100, 0, 100),
    riskMin: toInteger(url.searchParams.get("riskMin"), 0, 0, 100),
    windowHours: toInteger(url.searchParams.get("windowHours"), DEFAULT_WINDOW_HOURS, 1, 24 * 30),
  };
};

const normalizeDashboardEventType = (rawEventType: string): FraudDashboardEventType => {
  if (rawEventType === "signup_success") {
    return "signup_success";
  }

  if (rawEventType.includes("rate_limited")) {
    return "rate_limited";
  }

  if (rawEventType.includes("turnstile_invalid")) {
    return "invalid_turnstile";
  }

  return "blocked";
};

const getMetadataValue = (metadata: Json, key: string) => {
  if (!isRecord(metadata)) {
    return null;
  }

  return metadata[key] ?? null;
};

const getMetadataRiskScore = (metadata: Json) => toInteger(getMetadataValue(metadata, "risk_score"), 0, 0, 100);

const getMetadataDeviceFingerprint = (metadata: Json) => {
  const value = getMetadataValue(metadata, "device_fingerprint");
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

const buildVolumeSeries = (attempts: FraudAttempt[], windowHours: number): FraudVolumePoint[] => {
  const bucketMs = windowHours <= 48 ? 60 * 60 * 1_000 : 24 * 60 * 60 * 1_000;
  const labelFormatter = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    hour: bucketMs < 24 * 60 * 60 * 1_000 ? "2-digit" : undefined,
    month: "short",
  });
  const buckets = new Map<string, FraudVolumePoint>();

  for (const attempt of attempts) {
    const time = new Date(attempt.occurredAt).getTime();
    if (!Number.isFinite(time)) {
      continue;
    }

    const bucketStart = new Date(Math.floor(time / bucketMs) * bucketMs);
    const key = bucketStart.toISOString();

    if (!buckets.has(key)) {
      buckets.set(key, {
        blocked: 0,
        invalidTurnstile: 0,
        label: labelFormatter.format(bucketStart),
        rateLimited: 0,
        successful: 0,
        total: 0,
      });
    }

    const bucket = buckets.get(key);
    if (!bucket) {
      continue;
    }

    bucket.total += 1;

    if (attempt.eventType === "signup_success") {
      bucket.successful += 1;
      continue;
    }

    bucket.blocked += 1;

    if (attempt.eventType === "invalid_turnstile") {
      bucket.invalidTurnstile += 1;
    }

    if (attempt.eventType === "rate_limited") {
      bucket.rateLimited += 1;
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
};

const buildRiskDistribution = (attempts: FraudAttempt[]): FraudRiskDistributionPoint[] =>
  RISK_BUCKETS.map((bucket) => ({
    count: attempts.filter((attempt) => attempt.riskScore >= bucket.min && attempt.riskScore <= bucket.max).length,
    label: bucket.label,
  }));

const buildOutcomeBreakdown = (attempts: FraudAttempt[]): FraudOutcomePoint[] => {
  const successful = attempts.filter((attempt) => attempt.eventType === "signup_success").length;
  const blocked = attempts.length - successful;

  return [
    { label: "Successful", value: successful },
    { label: "Blocked", value: blocked },
  ];
};

const buildSummary = (attempts: FraudAttempt[]): FraudMetricSummary => {
  const totalSignups = attempts.length;
  const blockedAttempts = attempts.filter((attempt) => attempt.eventType !== "signup_success").length;
  const successfulSignups = totalSignups - blockedAttempts;
  const averageRiskScore =
    totalSignups === 0 ? 0 : roundToOneDecimal(attempts.reduce((sum, attempt) => sum + attempt.riskScore, 0) / totalSignups);
  const highRiskUsersCount = new Set(
    attempts.filter((attempt) => attempt.riskScore >= HIGH_RISK_THRESHOLD).map((attempt) => attempt.email || attempt.ip || attempt.id),
  ).size;

  return {
    averageRiskScore,
    blockedAttempts,
    highRiskUsersCount,
    successfulSignups,
    totalSignups,
  };
};

const buildRankedEntities = (attempts: FraudAttempt[], field: "email" | "ip"): FraudRankedEntity[] => {
  const entries = new Map<
    string,
    {
      count: number;
      lastSeenAt: string;
      riskSum: number;
      maxRiskScore: number;
    }
  >();

  for (const attempt of attempts) {
    const value = field === "email" ? normalizeEmail(attempt.email) : attempt.ip?.trim() || null;
    if (!value) {
      continue;
    }

    const current = entries.get(value) ?? {
      count: 0,
      lastSeenAt: attempt.occurredAt,
      maxRiskScore: 0,
      riskSum: 0,
    };

    current.count += 1;
    current.lastSeenAt = current.lastSeenAt > attempt.occurredAt ? current.lastSeenAt : attempt.occurredAt;
    current.maxRiskScore = Math.max(current.maxRiskScore, attempt.riskScore);
    current.riskSum += attempt.riskScore;
    entries.set(value, current);
  }

  return [...entries.entries()]
    .map(([value, entry]) => ({
      averageRiskScore: roundToOneDecimal(entry.riskSum / entry.count),
      count: entry.count,
      lastSeenAt: entry.lastSeenAt,
      maxRiskScore: entry.maxRiskScore,
      value,
    }))
    .sort((left, right) => {
      if (right.maxRiskScore !== left.maxRiskScore) {
        return right.maxRiskScore - left.maxRiskScore;
      }

      if (right.averageRiskScore !== left.averageRiskScore) {
        return right.averageRiskScore - left.averageRiskScore;
      }

      return right.count - left.count;
    })
    .slice(0, 5);
};

const buildBaseQuery = (filters: FraudStatsFilters, sinceIso: string) => {
  const supabaseAdmin = getSupabaseAdmin();
  const client = supabaseAdmin as typeof supabaseAdmin & {
    from: (table: "auth_security_logs") => {
      select: (columns: string) => unknown;
    };
  };

  let query = client
    .from("auth_security_logs")
    .select("id,user_id,email,ip,user_agent,event_type,metadata,created_at") as {
      gte: (column: "created_at", value: string) => unknown;
    };

  let filteredQuery = query.gte("created_at", sinceIso) as {
    ilike: (column: "email" | "ip", value: string) => unknown;
    order: (column: "created_at", options: { ascending: boolean }) => {
      limit: (
        value: number,
      ) => Promise<{ data: AuthSecurityLogRow[] | null; error: { message?: string } | null }>;
    };
  };

  if (filters.email) {
    filteredQuery = filteredQuery.ilike("email", `%${filters.email}%`) as typeof filteredQuery;
  }

  if (filters.ip) {
    filteredQuery = filteredQuery.ilike("ip", `%${filters.ip}%`) as typeof filteredQuery;
  }

  return filteredQuery.order("created_at", { ascending: false }).limit(filters.limit);
};

const fetchRecentAttempts = async (filters: FraudStatsFilters) => {
  const sinceIso = new Date(Date.now() - filters.windowHours * 60 * 60 * 1_000).toISOString();
  const { data, error } = await buildBaseQuery(filters, sinceIso);

  if (error) {
    throw new Error(error.message || "Failed to read auth security logs.");
  }

  return data ?? [];
};

const fetchConsentMap = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const client = supabaseAdmin as typeof supabaseAdmin & {
    from: (
      table: "user_consents",
    ) => {
      select: (
        columns: string,
      ) => {
        in: (
          column: "user_id",
          values: string[],
        ) => {
          order: (
            orderColumn: "consented_at",
            options: { ascending: boolean },
          ) => Promise<{ data: UserConsentRow[] | null; error: { message?: string } | null }>;
        };
      };
    };
  };

  const { data, error } = await client
    .from("user_consents")
    .select("user_id,consented_at")
    .in("user_id", userIds)
    .order("consented_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to read user consents.");
  }

  const consentMap = new Map<string, string>();
  for (const row of data ?? []) {
    if (!consentMap.has(row.user_id)) {
      consentMap.set(row.user_id, row.consented_at);
    }
  }

  return consentMap;
};

const hydrateAttempts = async (rows: AuthSecurityLogRow[], consentMap: Map<string, string>) => {
  const attempts = await Promise.all(
    rows
      .filter((row) => row.event_type.startsWith("signup_"))
      .map(async (row): Promise<FraudAttempt> => {
        const metadataRisk = getMetadataRiskScore(row.metadata);
        const deviceFingerprint = getMetadataDeviceFingerprint(row.metadata);
        const redisRisk = await getRiskSnapshot({
          deviceFingerprint,
          email: row.email,
          ip: row.ip,
        });
        const riskScore = Math.max(metadataRisk, redisRisk.max);

        return {
          consentedAt: row.user_id ? consentMap.get(row.user_id) ?? null : null,
          deviceFingerprint,
          email: normalizeEmail(row.email),
          eventType: normalizeDashboardEventType(row.event_type),
          id: row.id,
          ip: row.ip?.trim() || null,
          occurredAt: row.created_at,
          rawEventType: row.event_type,
          riskLevel: toRiskLevel(riskScore),
          riskScore,
          riskSources: {
            device: redisRisk.device,
            email: redisRisk.email,
            ip: redisRisk.ip,
            metadata: metadataRisk,
          },
          userAgent: row.user_agent,
          userId: row.user_id,
        };
      }),
  );

  return attempts;
};

const filterAttempts = (attempts: FraudAttempt[], filters: FraudStatsFilters) =>
  attempts.filter((attempt) => {
    if (filters.eventType !== "all" && attempt.eventType !== filters.eventType) {
      return false;
    }

    if (attempt.riskScore < filters.riskMin || attempt.riskScore > filters.riskMax) {
      return false;
    }

    return true;
  });

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const startedAt = Date.now();
  let responseStatus = 500;
  let userId: string | null = null;
  let dbTimeMs = 0;

  const timeDb = async <T>(work: () => Promise<T>) => {
    const started = Date.now();
    try {
      return await work();
    } finally {
      dbTimeMs += Date.now() - started;
    }
  };

  const finalize = <T extends NextResponse>(response: T) => {
    responseStatus = response.status;
    return response;
  };

  try {
    const auth = await timeDb(() => requireAdminRouteAccess(request));
    if ("response" in auth) {
      return finalize(auth.response);
    }

    userId = auth.accessMode === "user" ? auth.user.id : "admin-secret";

    const filters = parseFilters(request);
    const logs = await timeDb(() => fetchRecentAttempts(filters));
    const consentMap = await timeDb(() =>
      fetchConsentMap(
        [...new Set(logs.map((row) => row.user_id).filter((value): value is string => Boolean(value)))],
      ),
    );
    const hydratedAttempts = await timeDb(() => hydrateAttempts(logs, consentMap));
    const attempts = filterAttempts(hydratedAttempts, filters);

    const payload: FraudStatsResponse = {
      attempts,
      charts: {
        blockedVsSuccessful: buildOutcomeBreakdown(attempts),
        riskDistribution: buildRiskDistribution(attempts),
        signupVolume: buildVolumeSeries(attempts, filters.windowHours),
      },
      filters,
      generatedAt: new Date().toISOString(),
      summary: buildSummary(attempts),
      topRiskyEmails: buildRankedEntities(attempts, "email"),
      topRiskyIps: buildRankedEntities(attempts, "ip"),
    };

    return finalize(NextResponse.json<FraudStatsResponse>(payload, { status: 200 }));
  } catch (error) {
    logApiError({
      dbTimeMs,
      durationMs: Date.now() - startedAt,
      error,
      message: "Fraud dashboard stats request failed.",
      method: "GET",
      requestId,
      route: "/api/admin/fraud-stats",
      status: 500,
      userId,
    });

    return finalize(
      NextResponse.json(
        {
          error: "Failed to load fraud stats.",
        },
        { status: 500 },
      ),
    );
  } finally {
    logApiRequest({
      dbTimeMs,
      durationMs: Date.now() - startedAt,
      method: "GET",
      requestId,
      route: "/api/admin/fraud-stats",
      status: responseStatus,
      userId,
    });
  }
}
