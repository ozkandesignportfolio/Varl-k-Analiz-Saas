import { NextResponse } from "next/server";
import { calculateNextDueDate } from "@/lib/maintenance/next-due";
import type { DbClient } from "@/lib/repos/_shared";
import { existsById } from "@/lib/repos/assets-repo";
import {
  getById as getRuleById,
  updateById as updateRuleById,
} from "@/lib/repos/maintenance-rules-repo";
import {
  create as createServiceLog,
  getById as getServiceLogById,
  getLatestServiceDateForRule,
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

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateServiceLogPayload | null;

const readUpdateBody = async (request: Request) =>
  (await request.json().catch(() => null)) as UpdateServiceLogPayload | null;

const syncRuleScheduleFromLatestLog = async (params: {
  userId: string;
  ruleId: string;
  client: DbClient;
}) => {
  const { client, ruleId, userId } = params;
  const { data: rule, error: ruleError } = await getRuleById(client, {
    ruleId,
    userId,
  });

  if (ruleError || !rule) {
    return ruleError?.message ?? "Bakim kurali bulunamadi.";
  }

  const { data: latestLog, error: latestError } = await getLatestServiceDateForRule(client, {
    userId,
    ruleId,
    assetId: rule.asset_id,
  });

  if (latestError) {
    return latestError.message;
  }

  const latestServiceDate = latestLog?.service_date;
  if (!latestServiceDate) {
    return null;
  }

  let nextDueDate = "";
  try {
    nextDueDate = calculateNextDueDate({
      baseDate: latestServiceDate,
      intervalValue: rule.interval_value,
      intervalUnit: rule.interval_unit,
    });
  } catch (error) {
    return (error as Error).message;
  }

  const { error: updateRuleError } = await updateRuleById(client, {
    userId,
    ruleId,
    patch: {
      last_service_date: latestServiceDate,
      next_due_date: nextDueDate,
    },
  });

  return updateRuleError?.message ?? null;
};

export async function POST(request: Request) {
  const payload = await readBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
  }

  const assetId = String(payload.assetId ?? "").trim();
  const ruleId = String(payload.ruleId ?? "").trim();
  const serviceType = String(payload.serviceType ?? "").trim();
  const serviceDate = String(payload.serviceDate ?? "").trim();
  const cost = Number(payload.cost ?? 0);
  const provider = String(payload.provider ?? "").trim();
  const notes = String(payload.notes ?? "").trim();

  if (!assetId || !serviceType || !serviceDate) {
    return NextResponse.json(
      { error: "Varlik, servis turu ve servis tarihi zorunludur." },
      { status: 400 },
    );
  }

  if (!datePattern.test(serviceDate)) {
    return NextResponse.json({ error: "Gecersiz tarih formati." }, { status: 400 });
  }

  if (Number.isNaN(cost) || cost < 0) {
    return NextResponse.json({ error: "Maliyet gecersiz." }, { status: 400 });
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
      rule_id: ruleId || null,
      service_type: serviceType,
      service_date: serviceDate,
      cost,
      provider: provider || null,
      notes: notes || null,
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

  const serviceLogId = String(payload.id ?? "").trim();
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
    const nextAssetId = String(payload.assetId ?? "").trim();
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
    patch.rule_id = rawRuleId || null;
  }

  if (hasServiceType) {
    const nextServiceType = String(payload.serviceType ?? "").trim();
    if (!nextServiceType) {
      return NextResponse.json({ error: "Servis turu zorunludur." }, { status: 400 });
    }
    patch.service_type = nextServiceType;
  }

  if (hasServiceDate) {
    const nextServiceDate = String(payload.serviceDate ?? "").trim();
    if (!datePattern.test(nextServiceDate)) {
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
    const nextProvider = String(payload.provider ?? "").trim();
    patch.provider = nextProvider || null;
  }

  if (hasNotes) {
    const nextNotes = String(payload.notes ?? "").trim();
    patch.notes = nextNotes || null;
  }

  const targetAssetId = patch.asset_id ?? currentLog.asset_id;
  const targetRuleId = patch.rule_id !== undefined ? patch.rule_id : currentLog.rule_id;

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

  const syncErrors: string[] = [];
  for (const affectedRuleId of rulesToSync) {
    const syncError = await syncRuleScheduleFromLatestLog({
      client: supabase,
      userId: user.id,
      ruleId: affectedRuleId,
    });
    if (syncError) {
      syncErrors.push(syncError);
    }
  }

  if (syncErrors.length > 0) {
    return NextResponse.json(
      { ok: true, id: updatedLog.id, warning: `Bakim senkronizasyon uyarisi: ${syncErrors.join(" | ")}` },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, id: updatedLog.id }, { status: 200 });
}
