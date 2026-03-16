import type { BillingInvoiceTableRow } from "@/features/billing/components/billing-invoice-table";
import type { BillingSubscriptionTableRow } from "@/features/billing/components/billing-subscription-table";

export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type BillingCycle = "monthly" | "yearly";
export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";
export type InvoiceReadRow = Partial<BillingInvoiceTableRow>;

export const inputClassName =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-sky-400";

export const billingSetupHint =
  "Fatura tabloları veritabanında bulunamadı. 'supabase/migrations/20260217090000_repair_billing_invoices.sql' migrasyonunu çalıştırıp Supabase schema cache yenilemesi yapın.";
export const billingInvoiceSelectFull =
  "id,subscription_id,invoice_no,issued_at,due_date,paid_at,amount,tax_amount,total_amount,status,created_at";
export const billingInvoiceSelectFallback = "id,subscription_id,issued_at,amount,status,created_at";

export const toOptionalText = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isMissingTableError = (errorMessage: string, tableName: string) => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes(`public.${tableName}`.toLowerCase()) &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  );
};

export const isMissingColumnError = (errorMessage: string, tableName: string) => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes(tableName.toLowerCase()) &&
    normalized.includes("column") &&
    (normalized.includes("does not exist") || normalized.includes("schema cache"))
  );
};

const normalizeInvoiceStatus = (value: unknown): InvoiceStatus => {
  if (value === "pending" || value === "paid" || value === "overdue" || value === "cancelled") {
    return value;
  }
  return "pending";
};

export const normalizeInvoiceRow = (row: InvoiceReadRow): BillingInvoiceTableRow => {
  const amount = Number(row.amount ?? 0);
  const taxAmount = Number(row.tax_amount ?? 0);
  const totalAmountRaw = Number(row.total_amount ?? Number.NaN);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeTaxAmount = Number.isFinite(taxAmount) ? taxAmount : 0;
  const createdAt = row.created_at ?? row.issued_at ?? new Date().toISOString();
  const issuedAt = row.issued_at ?? createdAt;

  return {
    id: String(row.id ?? ""),
    subscription_id: String(row.subscription_id ?? ""),
    invoice_no: row.invoice_no ?? null,
    issued_at: issuedAt,
    due_date: row.due_date ?? null,
    paid_at: row.paid_at ?? null,
    amount: safeAmount,
    tax_amount: safeTaxAmount,
    total_amount: Number.isFinite(totalAmountRaw) ? totalAmountRaw : safeAmount + safeTaxAmount,
    status: normalizeInvoiceStatus(row.status),
    created_at: createdAt,
  };
};

export const buildSubscriptionLabelById = (subscriptions: BillingSubscriptionTableRow[]) =>
  new Map(
    subscriptions.map((subscription) => [
      subscription.id,
      `${subscription.provider_name} - ${subscription.subscription_name}`,
    ]),
  );

export const getActiveSubscriptions = (subscriptions: BillingSubscriptionTableRow[]) =>
  subscriptions.filter((subscription) => subscription.status === "active");

export const calculateMonthlyEquivalent = (subscriptions: BillingSubscriptionTableRow[]) =>
  subscriptions.reduce((sum, subscription) => {
    const amount = Number(subscription.amount ?? 0);
    return sum + (subscription.billing_cycle === "yearly" ? amount / 12 : amount);
  }, 0);

export const calculateNextThirtyDaysCount = (subscriptions: BillingSubscriptionTableRow[]) => {
  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(now.getDate() + 30);

  return subscriptions.filter((subscription) => {
    if (!subscription.next_billing_date) return false;
    const nextDate = new Date(subscription.next_billing_date);
    return nextDate >= now && nextDate <= maxDate;
  }).length;
};

export const calculateUnpaidInvoiceCount = (invoices: BillingInvoiceTableRow[]) =>
  invoices.filter((invoice) => invoice.status === "pending" || invoice.status === "overdue").length;

export const calculatePaidThisYear = (invoices: BillingInvoiceTableRow[]) => {
  const currentYear = new Date().getFullYear();
  return invoices
    .filter((invoice) => {
      if (invoice.status !== "paid") return false;
      if (!invoice.paid_at) return false;
      return new Date(invoice.paid_at).getFullYear() === currentYear;
    })
    .reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
};
