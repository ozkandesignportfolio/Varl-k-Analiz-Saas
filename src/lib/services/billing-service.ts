import { getById as getRuleById } from "@/lib/repos/maintenance-rules-repo";
import type { DbClient } from "@/lib/repos/_shared";
import {
  extractBillingMissingTables,
  getBillingSchemaState,
  isBillingMissingTableError,
  markBillingTablesMissing,
  toBillingFeatureDisabledErrorBody,
  type BillingTableName,
} from "@/lib/billing/schema-guard";
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
  | {
      status: number;
      body: {
        error: string;
        code?: string;
        feature?: "billing";
        missingTables?: BillingTableName[];
      };
    }
  | { status: number; body: { ok: true; id: string; warning?: string } };

type BillingCycle = "monthly" | "yearly";
type SubscriptionStatus = "active" | "paused" | "cancelled";
type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const billingCycles: BillingCycle[] = ["monthly", "yearly"];
const subscriptionStatuses: SubscriptionStatus[] = ["active", "paused", "cancelled"];
const invoiceStatuses: InvoiceStatus[] = ["pending", "paid", "overdue", "cancelled"];
const MAX_PROVIDER_NAME_LENGTH = 120;
const MAX_SUBSCRIPTION_NAME_LENGTH = 120;
const MAX_PLAN_NAME_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;
const MAX_INVOICE_NO_LENGTH = 120;

const toBillingDisabledResponse = (missingTables: readonly BillingTableName[]): BillingServiceResponse => ({
  status: 503,
  body: toBillingFeatureDisabledErrorBody(missingTables),
});

const mapRepoError = (
  error: { message?: string } | null,
  fallbackMessage: string,
  fallbackTables: readonly BillingTableName[],
): BillingServiceResponse | null => {
  if (!error) {
    return null;
  }

  if (isBillingMissingTableError(error, fallbackTables)) {
    const missingTables = extractBillingMissingTables(error, fallbackTables);
    markBillingTablesMissing(missingTables);
    return toBillingDisabledResponse(missingTables);
  }

  return { status: 400, body: { error: error.message ?? fallbackMessage } };
};

const ensureBillingTables = async (
  client: DbClient,
  requiredTables: readonly BillingTableName[],
): Promise<BillingServiceResponse | null> => {
  const schemaState = await getBillingSchemaState(client);
  const missingRequiredTables = requiredTables.filter((tableName) =>
    schemaState.missingTables.includes(tableName),
  );

  if (missingRequiredTables.length > 0) {
    return toBillingDisabledResponse(missingRequiredTables);
  }

  return null;
};

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

const readOptionalText = (value: unknown, maxLength: number) => {
  if (value === null || value === undefined) {
    return { value: null as string | null };
  }

  if (typeof value !== "string") {
    return { value: null as string | null, invalidType: true };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null as string | null };
  }

  if (trimmed.length > maxLength) {
    return { value: null as string | null, tooLong: true };
  }

  return { value: trimmed };
};

const readRequiredText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return { value: "", invalidType: true };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: "", missing: true };
  }

  if (trimmed.length > maxLength) {
    return { value: "", tooLong: true };
  }

  return { value: trimmed };
};

const readDateText = (value: unknown) => {
  if (value === null || value === undefined) {
    return { value: null as string | null };
  }

  if (typeof value !== "string") {
    return { value: null as string | null, invalidType: true };
  }

  const trimmed = value.trim();
  return { value: trimmed || null };
};

const readBoolean = (value: unknown, defaultValue: boolean) => {
  if (value === null || value === undefined) {
    return { value: defaultValue };
  }

  if (typeof value === "boolean") {
    return { value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return { value: true };
    }
    if (normalized === "false") {
      return { value: false };
    }
  }

  return { value: defaultValue, invalidType: true };
};

const normalizeUuid = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized)) {
    return null;
  }
  return normalized;
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
  const schemaCheck = await ensureBillingTables(client, ["billing_subscriptions"]);
  if (schemaCheck) {
    return schemaCheck;
  }

  const { payload, userId } = params;
  const providerNameResult = readRequiredText(payload.providerName, MAX_PROVIDER_NAME_LENGTH);
  const subscriptionNameResult = readRequiredText(payload.subscriptionName, MAX_SUBSCRIPTION_NAME_LENGTH);
  const planNameResult = readOptionalText(payload.planName, MAX_PLAN_NAME_LENGTH);
  const notesResult = readOptionalText(payload.notes, MAX_NOTES_LENGTH);
  const nextBillingDateResult = readDateText(payload.nextBillingDate);
  const maintenanceRuleIdResult = readDateText(payload.maintenanceRuleId);
  const billingCycleRaw =
    typeof payload.billingCycle === "string" ? payload.billingCycle.trim() : "monthly";
  const statusRaw = typeof payload.status === "string" ? payload.status.trim() : "active";
  const amount = Number(payload.amount ?? 0);
  const autoRenewResult = readBoolean(payload.autoRenew, true);

  if (
    providerNameResult.invalidType ||
    subscriptionNameResult.invalidType ||
    planNameResult.invalidType ||
    notesResult.invalidType ||
    nextBillingDateResult.invalidType ||
    maintenanceRuleIdResult.invalidType ||
    autoRenewResult.invalidType ||
    (payload.billingCycle !== undefined && typeof payload.billingCycle !== "string") ||
    (payload.status !== undefined && typeof payload.status !== "string")
  ) {
    return { status: 400, body: { error: "İstek alanı tipleri geçersiz." } };
  }

  if (
    providerNameResult.tooLong ||
    subscriptionNameResult.tooLong ||
    planNameResult.tooLong ||
    notesResult.tooLong
  ) {
    return { status: 400, body: { error: "Metin alanlarindan biri çok uzun." } };
  }

  const providerName = providerNameResult.value;
  const subscriptionName = subscriptionNameResult.value;
  const planName = planNameResult.value;
  const nextBillingDateRaw = nextBillingDateResult.value;
  const maintenanceRuleIdRaw = maintenanceRuleIdResult.value;
  const billingCycle = billingCycleRaw as BillingCycle;
  const status = statusRaw as SubscriptionStatus;
  const autoRenew = autoRenewResult.value;
  const notes = notesResult.value;

  if (!providerName || !subscriptionName) {
    return { status: 400, body: { error: "Sağlayıcı ve abonelik adı zorunludur." } };
  }

  if (!billingCycles.includes(billingCycle)) {
    return { status: 400, body: { error: "Geçersiz faturalama döngüsü." } };
  }

  if (!subscriptionStatuses.includes(status)) {
    return { status: 400, body: { error: "Geçersiz abonelik durumu." } };
  }

  if (!Number.isFinite(amount) || Number.isNaN(amount) || amount < 0) {
    return { status: 400, body: { error: "Abonelik tutarı geçersiz." } };
  }

  const maintenanceRuleId = maintenanceRuleIdRaw ? normalizeUuid(maintenanceRuleIdRaw) : null;
  if (maintenanceRuleIdRaw && !maintenanceRuleId) {
    return { status: 400, body: { error: "Bakım kuralı kimliği geçersiz." } };
  }

  if (maintenanceRuleId) {
    const { data: rule, error: ruleError } = await getRuleById(client, {
      userId,
      ruleId: maintenanceRuleId,
    });

    if (ruleError) {
      const mappedError = mapRepoError(ruleError, "Bakım kuralı kontrolü başarısız.", [
        "billing_subscriptions",
      ]);
      return mappedError ?? { status: 400, body: { error: ruleError.message } };
    }

    if (!rule) {
      return { status: 403, body: { error: "Seçilen bakım kuralına erişim izniniz yok." } };
    }
  }

  let nextBillingDate = nextBillingDateRaw;

  if (nextBillingDate) {
    if (!parseDateOnly(nextBillingDate)) {
      return { status: 400, body: { error: "Sonraki tahsilat tarihi geçersiz." } };
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
    const mappedError = mapRepoError(error, "Abonelik oluşturulamadı.", ["billing_subscriptions"]);
    return mappedError ?? { status: 400, body: { error: "Abonelik oluşturulamadı." } };
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
  const schemaCheck = await ensureBillingTables(client, ["billing_subscriptions", "billing_invoices"]);
  if (schemaCheck) {
    return schemaCheck;
  }

  const { payload, userId } = params;
  const subscriptionIdResult = readRequiredText(payload.subscriptionId, 64);
  const invoiceNoResult = readOptionalText(payload.invoiceNo, MAX_INVOICE_NO_LENGTH);
  const issuedAtResult = readDateText(payload.issuedAt);
  const dueDateResult = readDateText(payload.dueDate);
  const paidAtRawResult = readDateText(payload.paidAt);
  const statusRaw = typeof payload.status === "string" ? payload.status.trim() : "pending";
  const amount = Number(payload.amount ?? 0);
  const taxAmount = Number(payload.taxAmount ?? 0);
  const status = statusRaw as InvoiceStatus;

  if (
    subscriptionIdResult.invalidType ||
    invoiceNoResult.invalidType ||
    issuedAtResult.invalidType ||
    dueDateResult.invalidType ||
    paidAtRawResult.invalidType ||
    (payload.status !== undefined && typeof payload.status !== "string")
  ) {
    return { status: 400, body: { error: "İstek alanı tipleri geçersiz." } };
  }

  if (subscriptionIdResult.tooLong || invoiceNoResult.tooLong) {
    return { status: 400, body: { error: "Metin alanlarindan biri çok uzun." } };
  }

  const subscriptionIdRaw = subscriptionIdResult.value;
  const subscriptionId = normalizeUuid(subscriptionIdRaw);
  const invoiceNo = invoiceNoResult.value;
  const issuedAt = issuedAtResult.value ?? formatDateOnly(getTodayDateOnly());
  const dueDate = dueDateResult.value;
  const paidAtRaw = paidAtRawResult.value;

  if (!subscriptionIdRaw) {
    return { status: 400, body: { error: "Fatura için abonelik seçimi zorunludur." } };
  }

  if (!subscriptionId) {
    return { status: 400, body: { error: "Abonelik kimliği geçersiz." } };
  }

  if (!invoiceStatuses.includes(status)) {
    return { status: 400, body: { error: "Geçersiz fatura durumu." } };
  }

  if (!parseDateOnly(issuedAt)) {
    return { status: 400, body: { error: "Fatura tarihi geçersiz." } };
  }

  if (dueDate && !parseDateOnly(dueDate)) {
    return { status: 400, body: { error: "Vade tarihi geçersiz." } };
  }

  if (paidAtRaw && !parseDateOnly(paidAtRaw)) {
    return { status: 400, body: { error: "Ödeme tarihi geçersiz." } };
  }

  const issuedDate = parseDateOnly(issuedAt);
  const dueDateParsed = dueDate ? parseDateOnly(dueDate) : null;
  const paidDateParsed = paidAtRaw ? parseDateOnly(paidAtRaw) : null;

  if (!issuedDate) {
    return { status: 400, body: { error: "Fatura tarihi geçersiz." } };
  }

  if (dueDateParsed && dueDateParsed.getTime() < issuedDate.getTime()) {
    return { status: 400, body: { error: "Vade tarihi fatura tarihinden önce olamaz." } };
  }

  if (paidDateParsed && paidDateParsed.getTime() < issuedDate.getTime()) {
    return { status: 400, body: { error: "Ödeme tarihi fatura tarihinden önce olamaz." } };
  }

  if (!Number.isFinite(amount) || Number.isNaN(amount) || amount < 0) {
    return { status: 400, body: { error: "Fatura tutarı geçersiz." } };
  }

  if (!Number.isFinite(taxAmount) || Number.isNaN(taxAmount) || taxAmount < 0) {
    return { status: 400, body: { error: "Vergi tutarı geçersiz." } };
  }

  const { data: subscription, error: subscriptionError } = await getBillingSubscriptionById(client, {
    subscriptionId,
    userId,
  });

  if (subscriptionError) {
    const mappedError = mapRepoError(subscriptionError, "Abonelik bilgisi okunamadi.", [
      "billing_subscriptions",
    ]);
    return mappedError ?? { status: 400, body: { error: subscriptionError.message } };
  }

  if (!subscription) {
    return { status: 403, body: { error: "Seçilen abonelige erişim izniniz yok." } };
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
    const mappedError = mapRepoError(error, "Fatura oluşturulamadı.", ["billing_invoices"]);
    return mappedError ?? { status: 400, body: { error: "Fatura oluşturulamadı." } };
  }

  const hasValidBillingCycle = billingCycles.includes(subscription.billing_cycle as BillingCycle);
  const isAutoRenew = subscription.auto_renew === true;
  const isActiveSubscription = subscription.status === "active";

  if (status === "paid" && hasValidBillingCycle && isAutoRenew && isActiveSubscription) {
    const nextBillingDate = recalculateNextBillingDate({
      billingCycle: subscription.billing_cycle as BillingCycle,
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
        if (isBillingMissingTableError(subscriptionUpdateError, ["billing_subscriptions"])) {
          const missingTables = extractBillingMissingTables(subscriptionUpdateError, [
            "billing_subscriptions",
          ]);
          markBillingTablesMissing(missingTables);
          return toBillingDisabledResponse(missingTables);
        }

        return {
          status: 201,
          body: {
            ok: true,
            id: data.id,
            warning: `Yenileme tarihi güncellenemedi: ${subscriptionUpdateError.message}`,
          },
        };
      }
    }
  }

  return { status: 201, body: { ok: true, id: data.id } };
}


