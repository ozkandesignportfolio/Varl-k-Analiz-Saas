import { calculateNextDueDate, type IntervalUnit } from "@/lib/maintenance/next-due";
import { existsById } from "@/lib/repos/assets-repo";
import {
  create as createRule,
  getById as getRuleById,
  updateById as updateRuleById,
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

type ServiceResponse =
  | { status: number; body: { error: string } }
  | { status: number; body: { ok: true; id: string } };

const intervalUnits: IntervalUnit[] = ["day", "week", "month", "year"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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
      body: { error: "Varl\u0131k, ba\u015fl\u0131k ve baz tarih zorunludur." },
    };
  }

  if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
    return {
      status: 400,
      body: { error: "Interval de\u011feri pozitif bir tam say\u0131 olmal\u0131." },
    };
  }

  if (!intervalUnits.includes(intervalUnit)) {
    return { status: 400, body: { error: "Ge\u00e7ersiz interval birimi." } };
  }

  if (!datePattern.test(lastServiceDate)) {
    return { status: 400, body: { error: "Ge\u00e7ersiz tarih format\u0131." } };
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
      body: { error: "Se\u00e7ilen varl\u0131\u011fa eri\u015fim izniniz yok." },
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
      body: { error: error?.message ?? "Kural olu\u015fturulamad\u0131." },
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
    return { status: 404, body: { error: "Kural bulunamad\u0131." } };
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
    return { status: 400, body: { error: "G\u00fcncellenecek alan bulunamad\u0131." } };
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
      return { status: 400, body: { error: "Varl\u0131k se\u00e7imi zorunludur." } };
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
        body: { error: "Se\u00e7ilen varl\u0131\u011fa eri\u015fim izniniz yok." },
      };
    }

    updatePayload.asset_id = assetId;
  }

  if (hasTitle) {
    const title = String(payload.title ?? "").trim();
    if (!title) {
      return { status: 400, body: { error: "Kural ba\u015fl\u0131\u011f\u0131 zorunludur." } };
    }
    updatePayload.title = title;
  }

  if (hasIntervalValue) {
    const intervalValue = Number(payload.intervalValue);
    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      return {
        status: 400,
        body: { error: "Interval de\u011feri pozitif bir tam say\u0131 olmal\u0131." },
      };
    }
    updatePayload.interval_value = intervalValue;
  }

  if (hasIntervalUnit) {
    const intervalUnit = String(payload.intervalUnit ?? "").trim() as IntervalUnit;
    if (!intervalUnits.includes(intervalUnit)) {
      return { status: 400, body: { error: "Ge\u00e7ersiz interval birimi." } };
    }
    updatePayload.interval_unit = intervalUnit;
  }

  if (hasLastServiceDate) {
    const lastServiceDate = String(payload.lastServiceDate ?? "").trim();
    if (!datePattern.test(lastServiceDate)) {
      return { status: 400, body: { error: "Ge\u00e7ersiz tarih format\u0131." } };
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
        body: { error: "Baz tarih olmadan sonraki bak\u0131m tarihi hesaplanamaz." },
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
      body: { error: error?.message ?? "Kural g\u00fcncellenemedi." },
    };
  }

  return { status: 200, body: { ok: true, id: data.id } };
}
