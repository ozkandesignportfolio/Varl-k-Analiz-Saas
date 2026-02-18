import { NextResponse } from "next/server";
import { calculateNextDueDate } from "@/lib/maintenance/next-due";
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
  listLatestServiceDatesByRules,
  updateById as updateServiceLogById,
  type UpdateServiceLogByIdParams,
} from "@/lib/repos/service-logs-repo";
import { requireRouteUser } from "@/lib/supabase/route-auth";

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

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SERVICE_TYPE_LENGTH = 120;
const MAX_PROVIDER_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateServiceLogPayload | null;

const readUpdateBody = async (request: Request) =>
  (await request.json().catch(() => null)) as UpdateServiceLogPayload | null;

const parseDateOnly = (value: string): string | null => {
  const trimmed = value.trim();
  if (!datePattern.test(trimmed)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = trimmed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
};

const normalizeUuid = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!uuidPattern.test(normalized)) {
    return null;
  }
  return normalized;
};

const readOptionalText = (
  value: unknown,
  maxLength: number,
): { value: string | null; invalidType?: boolean; tooLong?: boolean } => {
  if (value === null || value === undefined) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { value: null, invalidType: true };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }

  if (trimmed.length > maxLength) {
    return { value: null, tooLong: true };
  }

  return { value: trimmed };
};

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
    return [rulesRes.error.message];
  }

  if (latestLogsRes.error) {
    return [latestLogsRes.error.message];
  }

  const rules = rulesRes.data ?? [];
  const latestLogsByRuleId = new Map(
    (latestLogsRes.data ?? []).map((item) => [item.rule_id, item.service_date]),
  );
  const syncErrors: string[] = [];

  const foundRuleIdSet = new Set(rules.map((rule) => rule.id));
  for (const ruleId of targetRuleIds) {
    if (!foundRuleIdSet.has(ruleId)) {
      syncErrors.push("Bakim kurali bulunamadi.");
    }
  }

  const updateTasks: Array<Promise<{ ruleId: string; error: string | null }>> = [];
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
      syncErrors.push((error as Error).message);
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
        error: result.error?.message ?? null,
      })),
    );
  }

  const updateResults = await Promise.all(updateTasks);
  for (const result of updateResults) {
    if (result.error) {
      syncErrors.push(`Kural ${result.ruleId}: ${result.error}`);
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
  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const assetId = normalizeUuid(payload.assetId);
  const rawRuleId = String(payload.ruleId ?? "").trim();
  const ruleId = rawRuleId ? normalizeUuid(rawRuleId) : null;
  const serviceType = String(payload.serviceType ?? "").trim();
  const serviceDate = String(payload.serviceDate ?? "").trim();
  const cost = Number(payload.cost ?? 0);
  const providerResult = readOptionalText(payload.provider, MAX_PROVIDER_LENGTH);
  const notesResult = readOptionalText(payload.notes, MAX_NOTES_LENGTH);

  if (!assetId || !serviceType || !serviceDate) {
    return NextResponse.json(
      { error: "Varlik, servis turu ve servis tarihi zorunludur." },
      { status: 400 },
    );
  }

  if (serviceType.length > MAX_SERVICE_TYPE_LENGTH) {
    return NextResponse.json({ error: "Servis turu cok uzun." }, { status: 400 });
  }

  if (!parseDateOnly(serviceDate)) {
    return NextResponse.json({ error: "Gecersiz tarih formati." }, { status: 400 });
  }

  if (rawRuleId && !ruleId) {
    return NextResponse.json({ error: "Bakim kurali kimligi gecersiz." }, { status: 400 });
  }

  if (Number.isNaN(cost) || cost < 0) {
    return NextResponse.json({ error: "Maliyet gecersiz." }, { status: 400 });
  }

  if (providerResult.invalidType || notesResult.invalidType) {
    return NextResponse.json({ error: "Metin alanlari gecersiz." }, { status: 400 });
  }

  if (providerResult.tooLong) {
    return NextResponse.json({ error: "Saglayici adi cok uzun." }, { status: 400 });
  }

  if (notesResult.tooLong) {
    return NextResponse.json({ error: "Not alani cok uzun." }, { status: 400 });
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, user } = auth;

  const { data: assetExists, error: assetError } = await existsById(supabase, {
    assetId,
    userId: user.id,
  });

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 400 });
  }

  if (!assetExists) {
    return NextResponse.json({ error: "Secilen varliga erisim izniniz yok." }, { status: 403 });
  }

  if (ruleId) {
    const { data: rule, error: ruleError } = await getRuleById(supabase, {
      ruleId,
      userId: user.id,
    });

    if (ruleError) {
      return NextResponse.json({ error: ruleError.message }, { status: 400 });
    }

    if (!rule || rule.asset_id !== assetId) {
      return NextResponse.json({ error: "Secilen bakim kuralina erisim izniniz yok." }, { status: 403 });
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
    return NextResponse.json({ error: error?.message ?? "Servis kaydi olusturulamadi." }, { status: 400 });
  }

  let warning: string | undefined;
  if (data.rule_id) {
    const syncError = await syncRuleScheduleFromLatestLog({
      client: supabase,
      userId: user.id,
      ruleId: data.rule_id,
    });
    if (syncError) {
      warning = `Bakim kurali tarihleri senkronize edilemedi: ${syncError}`;
    }
  }

  if (warning) {
    return NextResponse.json({ ok: true, id: data.id, warning }, { status: 201 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = await readUpdateBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const serviceLogId = normalizeUuid(payload.id);
  if (!serviceLogId) {
    return NextResponse.json({ error: "Servis kaydi kimligi zorunludur." }, { status: 400 });
  }

  const auth = await requireRouteUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, user } = auth;

  const { data: currentLog, error: currentLogError } = await getServiceLogById(supabase, {
    userId: user.id,
    serviceLogId,
  });

  if (currentLogError || !currentLog) {
    return NextResponse.json({ error: "Servis kaydi bulunamadi." }, { status: 404 });
  }

  const hasAssetId = payload.assetId !== undefined;
  const hasRuleId = payload.ruleId !== undefined;
  const hasServiceType = payload.serviceType !== undefined;
  const hasServiceDate = payload.serviceDate !== undefined;
  const hasCost = payload.cost !== undefined;
  const hasProvider = payload.provider !== undefined;
  const hasNotes = payload.notes !== undefined;

  if (!hasAssetId && !hasRuleId && !hasServiceType && !hasServiceDate && !hasCost && !hasProvider && !hasNotes) {
    return NextResponse.json({ error: "Guncellenecek alan bulunamadi." }, { status: 400 });
  }

  const patch: UpdateServiceLogByIdParams["patch"] = {};

  if (hasAssetId) {
    const nextAssetId = normalizeUuid(payload.assetId);
    if (!nextAssetId) {
      return NextResponse.json({ error: "Varlik secimi zorunludur." }, { status: 400 });
    }

    const { data: assetExists, error: assetError } = await existsById(supabase, {
      userId: user.id,
      assetId: nextAssetId,
    });

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 400 });
    }

    if (!assetExists) {
      return NextResponse.json({ error: "Secilen varliga erisim izniniz yok." }, { status: 403 });
    }

    patch.asset_id = nextAssetId;
  }

  if (hasRuleId) {
    const rawRuleId = String(payload.ruleId ?? "").trim();
    if (rawRuleId) {
      const nextRuleId = normalizeUuid(rawRuleId);
      if (!nextRuleId) {
        return NextResponse.json({ error: "Bakim kurali kimligi gecersiz." }, { status: 400 });
      }
      patch.rule_id = nextRuleId;
    } else {
      patch.rule_id = null;
    }
  }

  if (hasServiceType) {
    const nextServiceType = String(payload.serviceType ?? "").trim();
    if (!nextServiceType) {
      return NextResponse.json({ error: "Servis turu zorunludur." }, { status: 400 });
    }
    if (nextServiceType.length > MAX_SERVICE_TYPE_LENGTH) {
      return NextResponse.json({ error: "Servis turu cok uzun." }, { status: 400 });
    }
    patch.service_type = nextServiceType;
  }

  if (hasServiceDate) {
    const nextServiceDate = String(payload.serviceDate ?? "").trim();
    if (!parseDateOnly(nextServiceDate)) {
      return NextResponse.json({ error: "Gecersiz tarih formati." }, { status: 400 });
    }
    patch.service_date = nextServiceDate;
  }

  if (hasCost) {
    const nextCost = Number(payload.cost ?? 0);
    if (Number.isNaN(nextCost) || nextCost < 0) {
      return NextResponse.json({ error: "Maliyet gecersiz." }, { status: 400 });
    }
    patch.cost = nextCost;
  }

  if (hasProvider) {
    const nextProvider = readOptionalText(payload.provider, MAX_PROVIDER_LENGTH);
    if (nextProvider.invalidType) {
      return NextResponse.json({ error: "Saglayici alani gecersiz." }, { status: 400 });
    }
    if (nextProvider.tooLong) {
      return NextResponse.json({ error: "Saglayici adi cok uzun." }, { status: 400 });
    }
    patch.provider = nextProvider.value;
  }

  if (hasNotes) {
    const nextNotes = readOptionalText(payload.notes, MAX_NOTES_LENGTH);
    if (nextNotes.invalidType) {
      return NextResponse.json({ error: "Not alani gecersiz." }, { status: 400 });
    }
    if (nextNotes.tooLong) {
      return NextResponse.json({ error: "Not alani cok uzun." }, { status: 400 });
    }
    patch.notes = nextNotes.value;
  }

  const targetAssetId = patch.asset_id ?? currentLog.asset_id;
  const targetRuleId = patch.rule_id !== undefined ? patch.rule_id : currentLog.rule_id;

  if (!targetAssetId) {
    return NextResponse.json({ error: "Servis kaydinin varlik iliskisi gecersiz." }, { status: 400 });
  }

  if (targetRuleId) {
    const { data: rule, error: ruleError } = await getRuleById(supabase, {
      ruleId: targetRuleId,
      userId: user.id,
    });

    if (ruleError) {
      return NextResponse.json({ error: ruleError.message }, { status: 400 });
    }

    if (!rule || rule.asset_id !== targetAssetId) {
      return NextResponse.json({ error: "Secilen bakim kuralina erisim izniniz yok." }, { status: 403 });
    }
  }

  const { data: updatedLog, error: updateError } = await updateServiceLogById(supabase, {
    userId: user.id,
    serviceLogId,
    patch,
  });

  if (updateError || !updatedLog) {
    return NextResponse.json({ error: updateError?.message ?? "Servis kaydi guncellenemedi." }, { status: 400 });
  }

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
      { ok: true, id: updatedLog.id, warning: `Bakim senkronizasyon uyarisi: ${syncErrors.join(" | ")}` },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, id: updatedLog.id }, { status: 200 });
}
