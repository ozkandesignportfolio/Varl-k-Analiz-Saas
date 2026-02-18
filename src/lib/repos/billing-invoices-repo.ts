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

type SupabaseQueryResult = PromiseLike<{ data: unknown; error: PostgrestError | null }>;

const wrapBillingInvoicesQuery = async <T>(
  query: SupabaseQueryResult,
  emptyData: T | null,
): RepoResult<T> => {
  try {
    const response = await query;

    if (response.error && isBillingMissingTableError(response.error, [invoicesTable])) {
      const missingTables = extractBillingMissingTables(response.error, [invoicesTable]);
      markBillingTablesMissing(missingTables);
      return {
        data: emptyData,
        error: createBillingMissingTablePostgrestError(missingTables),
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
        error: createBillingMissingTablePostgrestError(missingTables),
      };
    }

    throw error;
  }
};

export function listByUser(
  client: DbClient,
  params: ListBillingInvoicesByUserParams,
): RepoResult<ListBillingInvoicesByUserRow[]> {
  const { userId } = params;

  return wrapBillingInvoicesQuery(
    client
      .from("billing_invoices")
      .select(
        "id,subscription_id,invoice_no,issued_at,due_date,paid_at,amount,tax_amount,total_amount,status,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    [],
  );
}

export function listByUserAndSubscription(
  client: DbClient,
  params: ListBillingInvoicesBySubscriptionParams,
): RepoResult<ListBillingInvoicesBySubscriptionRow[]> {
  const { subscriptionId, userId } = params;

  return wrapBillingInvoicesQuery(
    client
      .from("billing_invoices")
      .select(
        "id,subscription_id,invoice_no,issued_at,due_date,paid_at,amount,tax_amount,total_amount,status,created_at",
      )
      .eq("user_id", userId)
      .eq("subscription_id", subscriptionId)
      .order("created_at", { ascending: false }),
    [],
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
