import { NextResponse } from "next/server";
import { calculateNextDueDate } from "@/lib/maintenance/next-due";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { toPublicErrorBody } from "@/lib/api/public-error";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import type { DbClient } from "@/lib/repos/_shared";
import { existsById } from "@/lib/repos/assets-repo";
import {
  getById as getRuleById,
  listForScheduleSync as listRulesForScheduleSync,
  updateById as updateRuleById,
} from "@/lib/repos/maintenance-rules-repo";
import {
  create as createServiceLog,
  getById as getServiceLogById,
  listServices,
  listLatestServiceDatesByRules,
  updateById as updateServiceLogById,
  type UpdateServiceLogByIdParams,
} from "@/lib/repos/service-logs-repo";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { dateRange, optionalText, paginationSchema, parseDateOnly, uuid } from "@/lib/validation";

type CreateServiceLogPayload = {
  assetId?: unknown;
  ruleId?: unknown;
  serviceType?: unknown;
  serviceDate?: unknown;
  cost?: unknown;
  provider?: unknown;
  notes?: unknown;
};

type UpdateServiceLogPayload = {
  id?: unknown;
  assetId?: unknown;
  ruleId?: unknown;
  serviceType?: unknown;
  serviceDate?: unknown;
  cost?: unknown;
  provider?: unknown;
  notes?: unknown;
};

const MAX_SERVICE_TYPE_LENGTH = 120;
const MAX_PROVIDER_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateServiceLogPayload | null;

const readUpdateBody = async (request: Request) =>
  (await request.json().catch(() => null)) as UpdateServiceLogPayload | null;

const parseUuid = uuid();
const parseProviderText = optionalText(MAX_PROVIDER_LENGTH);
const parseNotesText = optionalText(MAX_NOTES_LENGTH);
const parseServiceLogsPagination = paginationSchema(
  (params) => {
    const cursorCreatedAt = params.get("cursorCreatedAt");
    const cursorIdRaw = params.get("cursorId");
    const cursorId = cursorIdRaw ? parseUuid(cursorIdRaw) : null;
    const cursorTimestamp =
      cursorCreatedAt && !Number.isNaN(new Date(cursorCreatedAt).getTime()) ? cursorCreatedAt : null;

    return cursorTimestamp && cursorId ? { createdAt: cursorTimestamp, id: cursorId } : null;
  },
  { fallback: 50, max: 100 },
);
const parseLogsDateRange = dateRange();
const SERVICE_LOG_SYNC_WARNING = "Bakım kuralı tarihleri senkronize edilemedi.";

export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
    const rl = enforceRateLimit({
      scope: "api",
      key: requestIp,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const params = new URL(request.url).searchParams;
    const { pageSize, cursor } = parseServiceLogsPagination(params);
    const assetIdRaw = params.get("assetId");
    const startDateRaw = params.get("startDate");
    const endDateRaw = params.get("endDate");

    const assetId = assetIdRaw ? parseUuid(assetIdRaw) : null;
    if (assetIdRaw && !assetId) {
      return NextResponse.json({ error: "Varlik filtresi gecersiz." }, { status: 400 });
    }

    const parsedDateRange = parseLogsDateRange(startDateRaw, endDateRaw);
    if (parsedDateRange.invalidStart) {
      return NextResponse.json({ error: "Baslangic tarihi gecersiz." }, { status: 400 });
    }

    if (parsedDateRange.invalidEnd) {
      return NextResponse.json({ error: "Bitis tarihi gecersiz." }, { status: 400 });
    }

    const { data, error } = await listServices(auth.supabase, {
      userId: auth.user.id,
      pageSize,
      cursor,
      filters: {
        assetId: assetId ?? undefined,
        startDate: parsedDateRange.startDate ?? undefined,
        endDate: parsedDateRange.endDate ?? undefined,
      },
    });

    if (error) {
      logApiError({
        route: "/api/service-logs",
        method: "GET",
        status: 400,
        userId: auth.user.id,
        error,
        message: "Service logs list query failed",
      });
      return NextResponse.json(
        toPublicErrorBody("SERVICE_LOGS_LIST_FAILED", "Servis kayitlari listelenemedi."),
        { status: 400 },
      );
    }

    return NextResponse.json(data ?? { rows: [], nextCursor: null, hasMore: false }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/service-logs",
      method: "GET",
      userId,
      error,
      message: "Service logs list request failed unexpectedly",
    });
    return NextResponse.json({ error: "Servis kayitlari listelenemedi." }, { status: 500 });
  }
}

const syncRuleSchedulesFromLatestLogs = async (params: {
  userId: string;
  ruleIds: string[];
  client: DbClient;
}) => {
  const { client, userId } = params;
  const targetRuleIds = [...new Set(params.ruleIds.filter((ruleId) => ruleId.trim().length > 0))];
  if (targetRuleIds.length === 0) {
    return [] as string[];
  }

  const [rulesRes, latestLogsRes] = await Promise.all([
    listRulesForScheduleSync(client, {
      userId,
      ruleIds: targetRuleIds,
    }),
    listLatestServiceDatesByRules(client, {
      userId,
      ruleIds: targetRuleIds,
    }),
  ]);

  if (rulesRes.error) {
    logApiError({
      route: "/api/service-logs",
      method: "SYNC",
      status: 400,
      userId,
      error: rulesRes.error,
      message: "Service log rule sync failed while loading rules",
      meta: { ruleIds: targetRuleIds },
    });
    return ["Bakım kuralı bilgileri alınamadı."];
  }

  if (latestLogsRes.error) {
    logApiError({
      route: "/api/service-logs",
      method: "SYNC",
      status: 400,
      userId,
      error: latestLogsRes.error,
      message: "Service log rule sync failed while loading latest logs",
      meta: { ruleIds: targetRuleIds },
    });
    return ["Son servis kaydı bilgileri alınamadı."];
  }

  const rules = rulesRes.data ?? [];
  const latestLogsByRuleId = new Map(
    (latestLogsRes.data ?? []).map((item) => [item.rule_id, item.service_date]),
  );
  const syncErrors: string[] = [];

  const foundRuleIdSet = new Set(rules.map((rule) => rule.id));
  for (const ruleId of targetRuleIds) {
    if (!foundRuleIdSet.has(ruleId)) {
      syncErrors.push("Bakım kuralı bulunamadı.");
    }
  }

  const updateTasks: Array<
    Promise<{ ruleId: string; error: Awaited<ReturnType<typeof updateRuleById>>["error"] }>
  > = [];
  for (const rule of rules) {
    const latestServiceDate = latestLogsByRuleId.get(rule.id);
    if (!latestServiceDate) {
      continue;
    }

    let nextDueDate = "";
    try {
      nextDueDate = calculateNextDueDate({
        baseDate: latestServiceDate,
        intervalValue: rule.interval_value,
        intervalUnit: rule.interval_unit,
      });
    } catch (error) {
      logApiError({
        route: "/api/service-logs",
        method: "SYNC",
        userId,
        error,
        message: "Service log rule sync failed while calculating next due date",
        meta: { ruleId: rule.id },
      });
      syncErrors.push("Bakım kuralı sonraki tarih hesabı yapılamadı.");
      continue;
    }

    updateTasks.push(
      updateRuleById(client, {
        userId,
        ruleId: rule.id,
        patch: {
          last_service_date: latestServiceDate,
          next_due_date: nextDueDate,
        },
      }).then((result) => ({
        ruleId: rule.id,
        error: result.error ?? null,
      })),
    );
  }

  const updateResults = await Promise.all(updateTasks);
  for (const result of updateResults) {
    if (result.error) {
      logApiError({
        route: "/api/service-logs",
        method: "SYNC",
        status: 400,
        userId,
        error: result.error,
        message: "Service log rule sync failed while updating rule schedule",
        meta: { ruleId: result.ruleId },
      });
      syncErrors.push(`Kural ${result.ruleId}: guncellenemedi.`);
    }
  }

  return syncErrors;
};

const syncRuleScheduleFromLatestLog = async (params: {
  userId: string;
  ruleId: string;
  client: DbClient;
}) => {
  const errors = await syncRuleSchedulesFromLatestLogs({
    client: params.client,
    userId: params.userId,
    ruleIds: [params.ruleId],
  });
  return errors.length > 0 ? errors.join(" | ") : null;
};

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
    const rl = enforceRateLimit({
      scope: "api",
      key: requestIp,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }

    const payload = await readBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const assetId = parseUuid(payload.assetId);
    const rawRuleId = String(payload.ruleId ?? "").trim();
    const ruleId = rawRuleId ? parseUuid(rawRuleId) : null;
    const serviceType = String(payload.serviceType ?? "").trim();
    const serviceDate = String(payload.serviceDate ?? "").trim();
    const cost = Number(payload.cost ?? 0);
    const providerResult = parseProviderText(payload.provider);
    const notesResult = parseNotesText(payload.notes);

    if (!assetId || !serviceType || !serviceDate) {
      return NextResponse.json(
        { error: "Varlık, servis türü ve servis tarihi zorunludur." },
        { status: 400 },
      );
    }

    if (serviceType.length > MAX_SERVICE_TYPE_LENGTH) {
      return NextResponse.json({ error: "Servis türü çok uzun." }, { status: 400 });
    }

    if (!parseDateOnly(serviceDate)) {
      return NextResponse.json({ error: "Geçersiz tarih formati." }, { status: 400 });
    }

    if (rawRuleId && !ruleId) {
      return NextResponse.json({ error: "Bakım kuralı kimliği geçersiz." }, { status: 400 });
    }

    if (Number.isNaN(cost) || cost < 0) {
      return NextResponse.json({ error: "Maliyet geçersiz." }, { status: 400 });
    }

    if (providerResult.invalidType || notesResult.invalidType) {
      return NextResponse.json({ error: "Metin alanları geçersiz." }, { status: 400 });
    }

    if (providerResult.tooLong) {
      return NextResponse.json({ error: "Sağlayıcı adı çok uzun." }, { status: 400 });
    }

    if (notesResult.tooLong) {
      return NextResponse.json({ error: "Not alanı çok uzun." }, { status: 400 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const { supabase, user } = auth;
    userId = user.id;

    const { data: assetExists, error: assetError } = await existsById(supabase, {
      assetId,
      userId: user.id,
    });

    if (assetError) {
      logApiError({
        route: "/api/service-logs",
        method: "POST",
        status: 400,
        userId: user.id,
        error: assetError,
        message: "Service log create asset lookup failed",
        meta: { assetId },
      });
      return NextResponse.json(
        toPublicErrorBody("SERVICE_LOG_ASSET_LOOKUP_FAILED", "Varlık erişimi şu anda doğrulanamadı."),
        { status: 400 },
      );
    }

    if (!assetExists) {
      return NextResponse.json({ error: "Seçilen varlığa erişim izniniz yok." }, { status: 403 });
    }

    if (ruleId) {
      const { data: rule, error: ruleError } = await getRuleById(supabase, {
        ruleId,
        userId: user.id,
      });

      if (ruleError) {
        logApiError({
          route: "/api/service-logs",
          method: "POST",
          status: 400,
          userId: user.id,
          error: ruleError,
          message: "Service log create rule lookup failed",
          meta: { ruleId, assetId },
        });
        return NextResponse.json(
          toPublicErrorBody("SERVICE_LOG_RULE_LOOKUP_FAILED", "Bakım kuralı erişimi şu anda doğrulanamadı."),
          { status: 400 },
        );
      }

      if (!rule || rule.asset_id !== assetId) {
        return NextResponse.json(
          { error: "Seçilen bakım kuralına erişim izniniz yok." },
          { status: 403 },
        );
      }
    }

    const { data, error } = await createServiceLog(supabase, {
      values: {
        user_id: user.id,
        asset_id: assetId,
        rule_id: ruleId,
        service_type: serviceType,
        service_date: serviceDate,
        cost,
        provider: providerResult.value,
        notes: notesResult.value,
      },
    });

    if (error || !data) {
      logApiError({
        route: "/api/service-logs",
        method: "POST",
        status: 400,
        userId: user.id,
        error: error ?? new Error("Service log insert returned without a row."),
        message: "Service log create query failed",
        meta: { assetId, ruleId },
      });
      return NextResponse.json(
        toPublicErrorBody("SERVICE_LOG_CREATE_FAILED", "Servis kaydı oluşturulamadı."),
        { status: 400 },
      );
    }

    let warning: string | undefined;
    if (data.rule_id) {
      const syncError = await syncRuleScheduleFromLatestLog({
        client: supabase,
        userId: user.id,
        ruleId: data.rule_id,
      });
      if (syncError) {
        warning = `${SERVICE_LOG_SYNC_WARNING} ${syncError}`;
      }
    }

    logAuditEvent({
      route: "/api/service-logs",
      userId: user.id,
      entityType: "service_logs",
      entityId: data.id,
      action: "create",
      meta: { ruleId: data.rule_id ?? null },
    });

    if (warning) {
      return NextResponse.json({ ok: true, id: data.id, warning }, { status: 201 });
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    logApiError({
      route: "/api/service-logs",
      method: "POST",
      userId,
      error,
      message: "Service log create request failed unexpectedly",
    });
    return NextResponse.json({ error: "Servis kaydı isteği işlenemedi." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null;
  try {
    const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
    const rl = enforceRateLimit({
      scope: "api",
      key: requestIp,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }

    const payload = await readUpdateBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const serviceLogId = parseUuid(payload.id);
    if (!serviceLogId) {
      return NextResponse.json({ error: "Servis kaydı kimliği zorunludur." }, { status: 400 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const { supabase, user } = auth;
    userId = user.id;

    const { data: currentLog, error: currentLogError } = await getServiceLogById(supabase, {
      userId: user.id,
      serviceLogId,
    });

    if (currentLogError || !currentLog) {
      return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });
    }

    const hasAssetId = payload.assetId !== undefined;
    const hasRuleId = payload.ruleId !== undefined;
    const hasServiceType = payload.serviceType !== undefined;
    const hasServiceDate = payload.serviceDate !== undefined;
    const hasCost = payload.cost !== undefined;
    const hasProvider = payload.provider !== undefined;
    const hasNotes = payload.notes !== undefined;

    if (!hasAssetId && !hasRuleId && !hasServiceType && !hasServiceDate && !hasCost && !hasProvider && !hasNotes) {
      return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
    }

    const patch: UpdateServiceLogByIdParams["patch"] = {};

    if (hasAssetId) {
      const nextAssetId = parseUuid(payload.assetId);
      if (!nextAssetId) {
        return NextResponse.json({ error: "Varlık seçimi zorunludur." }, { status: 400 });
      }

      const { data: assetExists, error: assetError } = await existsById(supabase, {
        userId: user.id,
        assetId: nextAssetId,
      });

      if (assetError) {
        logApiError({
          route: "/api/service-logs",
          method: "PATCH",
          status: 400,
          userId: user.id,
          error: assetError,
          message: "Service log update asset lookup failed",
          meta: { assetId: nextAssetId, serviceLogId },
        });
        return NextResponse.json(
          toPublicErrorBody("SERVICE_LOG_ASSET_LOOKUP_FAILED", "Varlık erişimi şu anda doğrulanamadı."),
          { status: 400 },
        );
      }

      if (!assetExists) {
        return NextResponse.json({ error: "Seçilen varlığa erişim izniniz yok." }, { status: 403 });
      }

      patch.asset_id = nextAssetId;
    }

    if (hasRuleId) {
      const rawRuleId = String(payload.ruleId ?? "").trim();
      if (rawRuleId) {
        const nextRuleId = parseUuid(rawRuleId);
        if (!nextRuleId) {
          return NextResponse.json({ error: "Bakım kuralı kimliği geçersiz." }, { status: 400 });
        }
        patch.rule_id = nextRuleId;
      } else {
        patch.rule_id = null;
      }
    }

    if (hasServiceType) {
      const nextServiceType = String(payload.serviceType ?? "").trim();
      if (!nextServiceType) {
        return NextResponse.json({ error: "Servis türü zorunludur." }, { status: 400 });
      }
      if (nextServiceType.length > MAX_SERVICE_TYPE_LENGTH) {
        return NextResponse.json({ error: "Servis türü çok uzun." }, { status: 400 });
      }
      patch.service_type = nextServiceType;
    }

    if (hasServiceDate) {
      const nextServiceDate = String(payload.serviceDate ?? "").trim();
      if (!parseDateOnly(nextServiceDate)) {
        return NextResponse.json({ error: "Geçersiz tarih formati." }, { status: 400 });
      }
      patch.service_date = nextServiceDate;
    }

    if (hasCost) {
      const nextCost = Number(payload.cost ?? 0);
      if (Number.isNaN(nextCost) || nextCost < 0) {
        return NextResponse.json({ error: "Maliyet geçersiz." }, { status: 400 });
      }
      patch.cost = nextCost;
    }

    if (hasProvider) {
      const nextProvider = parseProviderText(payload.provider);
      if (nextProvider.invalidType) {
        return NextResponse.json({ error: "Sağlayıcı alanı geçersiz." }, { status: 400 });
      }
      if (nextProvider.tooLong) {
        return NextResponse.json({ error: "Sağlayıcı adı çok uzun." }, { status: 400 });
      }
      patch.provider = nextProvider.value;
    }

    if (hasNotes) {
      const nextNotes = parseNotesText(payload.notes);
      if (nextNotes.invalidType) {
        return NextResponse.json({ error: "Not alanı geçersiz." }, { status: 400 });
      }
      if (nextNotes.tooLong) {
        return NextResponse.json({ error: "Not alanı çok uzun." }, { status: 400 });
      }
      patch.notes = nextNotes.value;
    }

    const targetAssetId = patch.asset_id ?? currentLog.asset_id;
    const targetRuleId = patch.rule_id !== undefined ? patch.rule_id : currentLog.rule_id;

    if (!targetAssetId) {
      return NextResponse.json({ error: "Servis kaydının varlık ilişkisi geçersiz." }, { status: 400 });
    }

    if (targetRuleId) {
      const { data: rule, error: ruleError } = await getRuleById(supabase, {
        ruleId: targetRuleId,
        userId: user.id,
      });

      if (ruleError) {
        logApiError({
          route: "/api/service-logs",
          method: "PATCH",
          status: 400,
          userId: user.id,
          error: ruleError,
          message: "Service log update rule lookup failed",
          meta: { ruleId: targetRuleId, serviceLogId },
        });
        return NextResponse.json(
          toPublicErrorBody("SERVICE_LOG_RULE_LOOKUP_FAILED", "Bakım kuralı erişimi şu anda doğrulanamadı."),
          { status: 400 },
        );
      }

      if (!rule || rule.asset_id !== targetAssetId) {
        return NextResponse.json({ error: "Seçilen bakım kuralına erişim izniniz yok." }, { status: 403 });
      }
    }

    const { data: updatedLog, error: updateError } = await updateServiceLogById(supabase, {
      userId: user.id,
      serviceLogId,
      patch,
    });

    if (updateError || !updatedLog) {
      logApiError({
        route: "/api/service-logs",
        method: "PATCH",
        status: 400,
        userId: user.id,
        error: updateError ?? new Error("Service log update returned without a row."),
        message: "Service log update query failed",
        meta: { serviceLogId },
      });
      return NextResponse.json(
        toPublicErrorBody("SERVICE_LOG_UPDATE_FAILED", "Servis kaydı güncellenemedi."),
        { status: 400 },
      );
    }

    logAuditEvent({
      route: "/api/service-logs",
      userId: user.id,
      entityType: "service_logs",
      entityId: updatedLog.id,
      action: "update",
      meta: { fields: Object.keys(patch) },
    });

    const rulesToSync = new Set<string>();
    if (currentLog.rule_id) {
      rulesToSync.add(currentLog.rule_id);
    }
    if (updatedLog.rule_id) {
      rulesToSync.add(updatedLog.rule_id);
    }

    const syncErrors = await syncRuleSchedulesFromLatestLogs({
      client: supabase,
      userId: user.id,
      ruleIds: [...rulesToSync],
    });

    if (syncErrors.length > 0) {
      return NextResponse.json(
        { ok: true, id: updatedLog.id, warning: `${SERVICE_LOG_SYNC_WARNING} ${syncErrors.join(" | ")}` },
        { status: 200 },
      );
    }

    return NextResponse.json({ ok: true, id: updatedLog.id }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/service-logs",
      method: "PATCH",
      userId,
      error,
      message: "Service log update request failed unexpectedly",
    });
    return NextResponse.json({ error: "Servis kaydı güncelleme isteği işlenemedi." }, { status: 500 });
  }
}
