import { getById as getRuleById } from "@/lib/repos/maintenance-rules-repo";
import type { DbClient } from "@/lib/repos/_shared";
import {
  create as createBillingInvoiceRecord,
} from "@/lib/repos/billing-invoices-repo";
import {
  create as createBillingSubscriptionRecord,
  getById as getBillingSubscriptionById,
  updateById as updateBillingSubscriptionById,
} from "@/lib/repos/billing-subscriptions-repo";

export type CreateBillingSubscriptionPayload = {
  providerName?: unknown;
  subscriptionName?: unknown;
  planName?: unknown;
  billingCycle?: unknown;
  amount?: unknown;
  nextBillingDate?: unknown;
  maintenanceRuleId?: unknown;
  status?: unknown;
  autoRenew?: unknown;
  notes?: unknown;
};

export type CreateBillingInvoicePayload = {
  subscriptionId?: unknown;
  invoiceNo?: unknown;
  issuedAt?: unknown;
  dueDate?: unknown;
  paidAt?: unknown;
  amount?: unknown;
  taxAmount?: unknown;
  status?: unknown;
};

type BillingServiceResponse =
  | { status: number; body: { error: string } }
  | { status: number; body: { ok: true; id: string; warning?: string } };

type BillingCycle = "monthly" | "yearly";
type SubscriptionStatus = "active" | "paused" | "cancelled";
type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const billingCycles: BillingCycle[] = ["monthly", "yearly"];
const subscriptionStatuses: SubscriptionStatus[] = ["active", "paused", "cancelled"];
const invoiceStatuses: InvoiceStatus[] = ["pending", "paid", "overdue", "cancelled"];

const parseDateOnly = (value: string): Date | null => {
  if (!datePattern.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
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

  return parsed;
};

const formatDateOnly = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toOptionalText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const toDateOnly = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const getTodayDateOnly = () => toDateOnly(new Date());

const addMonthsClamped = (value: Date, monthDelta: number) => {
  const sourceYear = value.getUTCFullYear();
  const sourceMonth = value.getUTCMonth();
  const sourceDay = value.getUTCDate();

  const targetMonthIndex = sourceMonth + monthDelta;
  const targetYear = sourceYear + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(sourceDay, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
};

const addBillingCycle = (value: Date, billingCycle: BillingCycle) =>
  addMonthsClamped(value, billingCycle === "yearly" ? 12 : 1);

const recalculateNextBillingDate = (params: {
  billingCycle: BillingCycle;
  currentNextBillingDate: string | null;
  issuedAt: string;
  paidAt: string | null;
}) => {
  const { billingCycle, currentNextBillingDate, issuedAt, paidAt } = params;
  const issuedDate = parseDateOnly(issuedAt);
  const paidDate = paidAt ? parseDateOnly(paidAt) : null;
  const baseline = paidDate ?? issuedDate;

  if (!baseline) {
    return null;
  }

  let nextDate = addBillingCycle(baseline, billingCycle);
  const currentNextDate = currentNextBillingDate ? parseDateOnly(currentNextBillingDate) : null;

  if (currentNextDate && currentNextDate.getTime() > baseline.getTime()) {
    nextDate = addBillingCycle(currentNextDate, billingCycle);
  }

  const today = getTodayDateOnly();
  while (nextDate.getTime() <= today.getTime()) {
    nextDate = addBillingCycle(nextDate, billingCycle);
  }

  return formatDateOnly(nextDate);
};

export async function createBillingSubscription(
  client: DbClient,
  params: {
    userId: string;
    payload: CreateBillingSubscriptionPayload;
  },
): Promise<BillingServiceResponse> {
  const { payload, userId } = params;
  const providerName = String(payload.providerName ?? "").trim();
  const subscriptionName = String(payload.subscriptionName ?? "").trim();
  const planName = toOptionalText(payload.planName);
  const billingCycle = String(payload.billingCycle ?? "monthly").trim() as BillingCycle;
  const amount = Number(payload.amount ?? 0);
  const nextBillingDateRaw = toOptionalText(payload.nextBillingDate);
  const maintenanceRuleId = toOptionalText(payload.maintenanceRuleId);
  const status = String(payload.status ?? "active").trim() as SubscriptionStatus;
  const autoRenew = String(payload.autoRenew ?? "true") === "true";
  const notes = toOptionalText(payload.notes);

  if (!providerName || !subscriptionName) {
    return { status: 400, body: { error: "Saglayici ve abonelik adi zorunludur." } };
  }

  if (!billingCycles.includes(billingCycle)) {
    return { status: 400, body: { error: "Gecersiz faturalama dongusu." } };
  }

  if (!subscriptionStatuses.includes(status)) {
    return { status: 400, body: { error: "Gecersiz abonelik durumu." } };
  }

  if (!Number.isFinite(amount) || Number.isNaN(amount) || amount < 0) {
    return { status: 400, body: { error: "Abonelik tutari gecersiz." } };
  }

  if (maintenanceRuleId) {
    const { data: rule, error: ruleError } = await getRuleById(client, {
      userId,
      ruleId: maintenanceRuleId,
    });

    if (ruleError) {
      return { status: 400, body: { error: ruleError.message } };
    }

    if (!rule) {
      return { status: 403, body: { error: "Secilen bakim kuralina erisim izniniz yok." } };
    }
  }

  let nextBillingDate = nextBillingDateRaw;

  if (nextBillingDate) {
    if (!parseDateOnly(nextBillingDate)) {
      return { status: 400, body: { error: "Sonraki tahsilat tarihi gecersiz." } };
    }
  } else if (status === "active" && autoRenew) {
    nextBillingDate = formatDateOnly(addBillingCycle(getTodayDateOnly(), billingCycle));
  }

  const { data, error } = await createBillingSubscriptionRecord(client, {
    values: {
      user_id: userId,
      maintenance_rule_id: maintenanceRuleId,
      provider_name: providerName,
      subscription_name: subscriptionName,
      plan_name: planName,
      billing_cycle: billingCycle,
      amount,
      currency: "TRY",
      next_billing_date: nextBillingDate,
      auto_renew: autoRenew,
      status,
      notes,
    },
  });

  if (error || !data) {
    return { status: 400, body: { error: error?.message ?? "Abonelik olusturulamadi." } };
  }

  return { status: 201, body: { ok: true, id: data.id } };
}

export async function createBillingInvoice(
  client: DbClient,
  params: {
    userId: string;
    payload: CreateBillingInvoicePayload;
  },
): Promise<BillingServiceResponse> {
  const { payload, userId } = params;
  const subscriptionId = String(payload.subscriptionId ?? "").trim();
  const invoiceNo = toOptionalText(payload.invoiceNo);
  const issuedAt = String(payload.issuedAt ?? formatDateOnly(getTodayDateOnly())).trim();
  const dueDate = toOptionalText(payload.dueDate);
  const paidAtRaw = toOptionalText(payload.paidAt);
  const amount = Number(payload.amount ?? 0);
  const taxAmount = Number(payload.taxAmount ?? 0);
  const status = String(payload.status ?? "pending").trim() as InvoiceStatus;

  if (!subscriptionId) {
    return { status: 400, body: { error: "Fatura icin abonelik secimi zorunludur." } };
  }

  if (!invoiceStatuses.includes(status)) {
    return { status: 400, body: { error: "Gecersiz fatura durumu." } };
  }

  if (!parseDateOnly(issuedAt)) {
    return { status: 400, body: { error: "Fatura tarihi gecersiz." } };
  }

  if (dueDate && !parseDateOnly(dueDate)) {
    return { status: 400, body: { error: "Vade tarihi gecersiz." } };
  }

  if (paidAtRaw && !parseDateOnly(paidAtRaw)) {
    return { status: 400, body: { error: "Odeme tarihi gecersiz." } };
  }

  if (!Number.isFinite(amount) || Number.isNaN(amount) || amount < 0) {
    return { status: 400, body: { error: "Fatura tutari gecersiz." } };
  }

  if (!Number.isFinite(taxAmount) || Number.isNaN(taxAmount) || taxAmount < 0) {
    return { status: 400, body: { error: "Vergi tutari gecersiz." } };
  }

  const { data: subscription, error: subscriptionError } = await getBillingSubscriptionById(client, {
    subscriptionId,
    userId,
  });

  if (subscriptionError) {
    return { status: 400, body: { error: subscriptionError.message } };
  }

  if (!subscription) {
    return { status: 403, body: { error: "Secilen abonelige erisim izniniz yok." } };
  }

  const paidAt = status === "paid" ? paidAtRaw ?? issuedAt : null;
  const totalAmount = amount + taxAmount;

  const { data, error } = await createBillingInvoiceRecord(client, {
    values: {
      user_id: userId,
      subscription_id: subscriptionId,
      invoice_no: invoiceNo,
      issued_at: issuedAt,
      due_date: dueDate,
      paid_at: paidAt,
      amount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status,
    },
  });

  if (error || !data) {
    return { status: 400, body: { error: error?.message ?? "Fatura olusturulamadi." } };
  }

  if (status === "paid" && subscription.auto_renew && subscription.status === "active") {
    const nextBillingDate = recalculateNextBillingDate({
      billingCycle: subscription.billing_cycle,
      currentNextBillingDate: subscription.next_billing_date,
      issuedAt,
      paidAt,
    });

    if (nextBillingDate) {
      const { error: subscriptionUpdateError } = await updateBillingSubscriptionById(client, {
        userId,
        subscriptionId,
        patch: { next_billing_date: nextBillingDate },
      });

      if (subscriptionUpdateError) {
        return {
          status: 201,
          body: {
            ok: true,
            id: data.id,
            warning: `Yenileme tarihi guncellenemedi: ${subscriptionUpdateError.message}`,
          },
        };
      }
    }
  }

  return { status: 201, body: { ok: true, id: data.id } };
}
