import { calculateNextDueDate, type IntervalUnit } from "@/lib/maintenance/next-due";
import { existsById } from "@/lib/repos/assets-repo";
import {
  create as createRule,
  deleteById as deleteRuleById,
  getById as getRuleById,
  listByUser as listRulesByUser,
  updateById as updateRuleById,
  type GetRuleByIdRow,
  type ListRulesByUserRow,
} from "@/lib/repos/maintenance-rules-repo";
import type { DbClient } from "@/lib/repos/_shared";

export type CreateRulePayload = {
  assetId?: unknown;
  title?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
  lastServiceDate?: unknown;
};

export type UpdateRulePayload = {
  assetId?: unknown;
  title?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
  lastServiceDate?: unknown;
  isActive?: unknown;
};

type RuleItem = {
  id: string;
  assetId: string;
  title: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  lastServiceDate: string | null;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ServiceResponse =
  | { status: number; body: { error: string } }
  | { status: number; body: { ok: true; id: string } };

type RuleReadResponse =
  | { status: number; body: { error: string } }
  | { status: number; body: RuleItem };

type RuleListResponse =
  | { status: number; body: { error: string } }
  | { status: number; body: { items: RuleItem[] } };

const intervalUnits: IntervalUnit[] = ["day", "week", "month", "year"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const toRuleItem = (rule: GetRuleByIdRow | ListRulesByUserRow): RuleItem => ({
  id: rule.id,
  assetId: rule.asset_id,
  title: rule.title,
  intervalValue: rule.interval_value,
  intervalUnit: rule.interval_unit,
  lastServiceDate: rule.last_service_date,
  nextDueDate: rule.next_due_date,
  isActive: rule.is_active,
  createdAt: rule.created_at,
  updatedAt: rule.updated_at,
});

export async function listMaintenanceRules(
  client: DbClient,
  params: { userId: string },
): Promise<RuleListResponse> {
  const { data, error } = await listRulesByUser(client, { userId: params.userId });

  if (error) {
    return {
      status: 400,
      body: { error: error.message },
    };
  }

  return {
    status: 200,
    body: { items: (data ?? []).map((rule) => toRuleItem(rule)) },
  };
}

export async function getMaintenanceRule(
  client: DbClient,
  params: { userId: string; ruleId: string },
): Promise<RuleReadResponse> {
  const { data, error } = await getRuleById(client, {
    ruleId: params.ruleId,
    userId: params.userId,
  });

  if (error || !data) {
    return {
      status: 404,
      body: { error: "Kural bulunamadi." },
    };
  }

  return {
    status: 200,
    body: toRuleItem(data),
  };
}

export async function createMaintenanceRule(
  client: DbClient,
  params: {
    userId: string;
    payload: CreateRulePayload;
  },
): Promise<ServiceResponse> {
  const { payload, userId } = params;

  const assetId = String(payload.assetId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const intervalValue = Number(payload.intervalValue);
  const intervalUnit = String(payload.intervalUnit ?? "").trim() as IntervalUnit;
  const lastServiceDate = String(payload.lastServiceDate ?? "").trim();

  if (!assetId || !title || !lastServiceDate) {
    return {
      status: 400,
      body: { error: "Varlik, baslik ve baz tarih zorunludur." },
    };
  }

  if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
    return {
      status: 400,
      body: { error: "Interval degeri pozitif bir tam sayi olmali." },
    };
  }

  if (!intervalUnits.includes(intervalUnit)) {
    return { status: 400, body: { error: "Gecersiz interval birimi." } };
  }

  if (!datePattern.test(lastServiceDate)) {
    return { status: 400, body: { error: "Gecersiz tarih formati." } };
  }

  let nextDueDate = "";
  try {
    nextDueDate = calculateNextDueDate({
      baseDate: lastServiceDate,
      intervalValue,
      intervalUnit,
    });
  } catch (error) {
    return { status: 400, body: { error: (error as Error).message } };
  }

  const { data: assetExists, error: assetError } = await existsById(client, {
    assetId,
    userId,
  });

  if (assetError) {
    return { status: 400, body: { error: assetError.message } };
  }

  if (!assetExists) {
    return {
      status: 403,
      body: { error: "Secilen varliga erisim izniniz yok." },
    };
  }

  const { data, error } = await createRule(client, {
    values: {
      user_id: userId,
      asset_id: assetId,
      title,
      interval_value: intervalValue,
      interval_unit: intervalUnit,
      last_service_date: lastServiceDate,
      next_due_date: nextDueDate,
      is_active: true,
    },
  });

  if (error || !data) {
    return {
      status: 400,
      body: { error: error?.message ?? "Kural olusturulamadi." },
    };
  }

  return { status: 201, body: { ok: true, id: data.id } };
}

export async function updateMaintenanceRule(
  client: DbClient,
  params: {
    userId: string;
    ruleId: string;
    payload: UpdateRulePayload;
  },
): Promise<ServiceResponse> {
  const { payload, ruleId, userId } = params;

  const { data: currentRule, error: currentRuleError } = await getRuleById(client, {
    ruleId,
    userId,
  });

  if (currentRuleError || !currentRule) {
    return { status: 404, body: { error: "Kural bulunamadi." } };
  }

  const hasAssetId = payload.assetId !== undefined;
  const hasTitle = payload.title !== undefined;
  const hasIntervalValue = payload.intervalValue !== undefined;
  const hasIntervalUnit = payload.intervalUnit !== undefined;
  const hasLastServiceDate = payload.lastServiceDate !== undefined;
  const hasIsActive = payload.isActive !== undefined;

  if (
    !hasAssetId &&
    !hasTitle &&
    !hasIntervalValue &&
    !hasIntervalUnit &&
    !hasLastServiceDate &&
    !hasIsActive
  ) {
    return { status: 400, body: { error: "Guncellenecek alan bulunamadi." } };
  }

  const updatePayload: {
    asset_id?: string;
    title?: string;
    interval_value?: number;
    interval_unit?: IntervalUnit;
    last_service_date?: string;
    next_due_date?: string;
    is_active?: boolean;
  } = {};

  if (hasAssetId) {
    const assetId = String(payload.assetId ?? "").trim();
    if (!assetId) {
      return { status: 400, body: { error: "Varlik secimi zorunludur." } };
    }

    const { data: assetExists, error: assetError } = await existsById(client, {
      assetId,
      userId,
    });

    if (assetError) {
      return { status: 400, body: { error: assetError.message } };
    }

    if (!assetExists) {
      return {
        status: 403,
        body: { error: "Secilen varliga erisim izniniz yok." },
      };
    }

    updatePayload.asset_id = assetId;
  }

  if (hasTitle) {
    const title = String(payload.title ?? "").trim();
    if (!title) {
      return { status: 400, body: { error: "Kural basligi zorunludur." } };
    }
    updatePayload.title = title;
  }

  if (hasIntervalValue) {
    const intervalValue = Number(payload.intervalValue);
    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      return {
        status: 400,
        body: { error: "Interval degeri pozitif bir tam sayi olmali." },
      };
    }
    updatePayload.interval_value = intervalValue;
  }

  if (hasIntervalUnit) {
    const intervalUnit = String(payload.intervalUnit ?? "").trim() as IntervalUnit;
    if (!intervalUnits.includes(intervalUnit)) {
      return { status: 400, body: { error: "Gecersiz interval birimi." } };
    }
    updatePayload.interval_unit = intervalUnit;
  }

  if (hasLastServiceDate) {
    const lastServiceDate = String(payload.lastServiceDate ?? "").trim();
    if (!datePattern.test(lastServiceDate)) {
      return { status: 400, body: { error: "Gecersiz tarih formati." } };
    }
    updatePayload.last_service_date = lastServiceDate;
  }

  if (hasIsActive) {
    updatePayload.is_active = Boolean(payload.isActive);
  }

  if (hasIntervalValue || hasIntervalUnit || hasLastServiceDate) {
    const baseDate = updatePayload.last_service_date ?? currentRule.last_service_date;
    const intervalValue = updatePayload.interval_value ?? currentRule.interval_value;
    const intervalUnit = updatePayload.interval_unit ?? currentRule.interval_unit;

    if (!baseDate) {
      return {
        status: 400,
        body: { error: "Baz tarih olmadan sonraki bakim tarihi hesaplanamaz." },
      };
    }

    try {
      updatePayload.next_due_date = calculateNextDueDate({
        baseDate,
        intervalValue,
        intervalUnit,
      });
    } catch (error) {
      return { status: 400, body: { error: (error as Error).message } };
    }
  }

  const { data, error } = await updateRuleById(client, {
    userId,
    ruleId,
    patch: updatePayload,
  });

  if (error || !data) {
    return {
      status: 400,
      body: { error: error?.message ?? "Kural guncellenemedi." },
    };
  }

  return { status: 200, body: { ok: true, id: data.id } };
}

export async function deleteMaintenanceRule(
  client: DbClient,
  params: { userId: string; ruleId: string },
): Promise<ServiceResponse> {
  const { data, error } = await deleteRuleById(client, {
    ruleId: params.ruleId,
    userId: params.userId,
  });

  if (error || !data) {
    return {
      status: 404,
      body: { error: "Kural silinemedi veya bulunamadi." },
    };
  }

  return {
    status: 200,
    body: { ok: true, id: data.id },
  };
}
