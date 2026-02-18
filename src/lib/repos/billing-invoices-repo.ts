import type { PostgrestError } from "@supabase/supabase-js";
import {
  createBillingMissingTablePostgrestError,
  extractBillingMissingTables,
  isBillingMissingTableError,
  markBillingTablesMissing,
  type BillingTableName,
} from "@/lib/billing/schema-guard";
import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListBillingInvoicesByUserParams = {
  userId: string;
};

export type ListBillingInvoicesByUserRow = Pick<
  Row<"billing_invoices">,
  | "id"
  | "subscription_id"
  | "invoice_no"
  | "issued_at"
  | "due_date"
  | "paid_at"
  | "amount"
  | "tax_amount"
  | "total_amount"
  | "status"
  | "created_at"
>;

export type ListBillingInvoicesBySubscriptionParams = {
  userId: string;
  subscriptionId: string;
};

export type ListBillingInvoicesBySubscriptionRow = Pick<
  Row<"billing_invoices">,
  | "id"
  | "subscription_id"
  | "invoice_no"
  | "issued_at"
  | "due_date"
  | "paid_at"
  | "amount"
  | "tax_amount"
  | "total_amount"
  | "status"
  | "created_at"
>;

export type CreateBillingInvoiceParams = {
  values: Insert<"billing_invoices">;
};

export type CreateBillingInvoiceRow = Pick<Row<"billing_invoices">, "id">;

export type UpdateBillingInvoiceByIdParams = {
  userId: string;
  invoiceId: string;
  patch: Update<"billing_invoices">;
};

export type UpdateBillingInvoiceByIdRow = Pick<Row<"billing_invoices">, "id">;

const invoicesTable: BillingTableName = "billing_invoices";
const billingInvoiceSelectFull =
  "id,subscription_id,invoice_no,issued_at,due_date,paid_at,amount,tax_amount,total_amount,status,created_at";
const billingInvoiceSelectFallback = "id,subscription_id,issued_at,amount,status,created_at";
const missingColumnCodes = new Set(["42703", "PGRST204"]);

type SupabaseQueryResult = PromiseLike<{ data: unknown; error: PostgrestError | null }>;
type InvoiceListRow = ListBillingInvoicesByUserRow;
type InvoiceListReadRow = Partial<InvoiceListRow>;

const wrapBillingInvoicesQuery = async <T>(
  query: SupabaseQueryResult,
  emptyData: T | null,
  options?: { suppressMissingTableError?: boolean },
): RepoResult<T> => {
  const suppressMissingTableError = options?.suppressMissingTableError ?? false;

  try {
    const response = await query;

    if (response.error && isBillingMissingTableError(response.error, [invoicesTable])) {
      const missingTables = extractBillingMissingTables(response.error, [invoicesTable]);
      markBillingTablesMissing(missingTables);
      return {
        data: emptyData,
        error: suppressMissingTableError ? null : createBillingMissingTablePostgrestError(missingTables),
      };
    }

    return {
      data: (response.data as T | null) ?? emptyData,
      error: response.error,
    };
  } catch (error) {
    if (isBillingMissingTableError(error, [invoicesTable])) {
      const missingTables = extractBillingMissingTables(error, [invoicesTable]);
      markBillingTablesMissing(missingTables);
      return {
        data: emptyData,
        error: suppressMissingTableError ? null : createBillingMissingTablePostgrestError(missingTables),
      };
    }

    throw error;
  }
};

const isMissingInvoiceColumnError = (error: PostgrestError | null) => {
  if (!error) return false;

  const message = error.message.toLowerCase();
  if (!message.includes("billing_invoices")) return false;

  if (error.code && missingColumnCodes.has(error.code)) {
    return true;
  }

  return message.includes("column") && (message.includes("does not exist") || message.includes("schema cache"));
};

const normalizeInvoiceStatus = (value: unknown): InvoiceListRow["status"] => {
  if (value === "pending" || value === "paid" || value === "overdue" || value === "cancelled") {
    return value;
  }

  return "pending";
};

const normalizeInvoiceRow = (row: InvoiceListReadRow): InvoiceListRow => {
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

const normalizeInvoiceRows = (rows: InvoiceListReadRow[] | null | undefined): InvoiceListRow[] =>
  (rows ?? []).map((row) => normalizeInvoiceRow(row));

const executeInvoiceListQuery = async (
  queryFactory: (selectColumns: string) => SupabaseQueryResult,
): RepoResult<InvoiceListRow[]> => {
  const primary = await wrapBillingInvoicesQuery<InvoiceListReadRow[]>(queryFactory(billingInvoiceSelectFull), [], {
    suppressMissingTableError: true,
  });

  if (primary.error && isMissingInvoiceColumnError(primary.error)) {
    const fallback = await wrapBillingInvoicesQuery<InvoiceListReadRow[]>(
      queryFactory(billingInvoiceSelectFallback),
      [],
      { suppressMissingTableError: true },
    );

    return {
      data: normalizeInvoiceRows(fallback.data),
      error: fallback.error,
    };
  }

  return {
    data: normalizeInvoiceRows(primary.data),
    error: primary.error,
  };
};

export function listByUser(
  client: DbClient,
  params: ListBillingInvoicesByUserParams,
): RepoResult<ListBillingInvoicesByUserRow[]> {
  const { userId } = params;

  return executeInvoiceListQuery((selectColumns) =>
    client
      .from("billing_invoices")
      .select(selectColumns)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  );
}

export function listByUserAndSubscription(
  client: DbClient,
  params: ListBillingInvoicesBySubscriptionParams,
): RepoResult<ListBillingInvoicesBySubscriptionRow[]> {
  const { subscriptionId, userId } = params;

  return executeInvoiceListQuery((selectColumns) =>
    client
      .from("billing_invoices")
      .select(selectColumns)
      .eq("user_id", userId)
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false }),
  );
}

export function create(
  client: DbClient,
  params: CreateBillingInvoiceParams,
): RepoResult<CreateBillingInvoiceRow> {
  const { values } = params;
  const table = client.from("billing_invoices") as unknown as {
    insert: (insertValues: CreateBillingInvoiceParams["values"]) => {
      select: (columns: "id") => {
        single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
      };
    };
  };

  return wrapBillingInvoicesQuery(table.insert(values).select("id").single(), null);
}

export function updateById(
  client: DbClient,
  params: UpdateBillingInvoiceByIdParams,
): RepoResult<UpdateBillingInvoiceByIdRow> {
  const { invoiceId, patch, userId } = params;
  const table = client.from("billing_invoices") as unknown as {
    update: (updateValues: UpdateBillingInvoiceByIdParams["patch"]) => {
      eq: (column: "id", value: string) => {
        eq: (userColumn: "user_id", userValue: string) => {
          select: (columns: "id") => {
            single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
          };
        };
      };
    };
  };

  return wrapBillingInvoicesQuery(
    table
      .update(patch)
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .select("id")
      .single(),
    null,
  );
}
