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

export function listByUser(
  _client: DbClient,
  _params: ListBillingInvoicesByUserParams,
): RepoResult<ListBillingInvoicesByUserRow[]> {
  throw new Error("not implemented");
}

export function listByUserAndSubscription(
  _client: DbClient,
  _params: ListBillingInvoicesBySubscriptionParams,
): RepoResult<ListBillingInvoicesBySubscriptionRow[]> {
  throw new Error("not implemented");
}

export function create(
  _client: DbClient,
  _params: CreateBillingInvoiceParams,
): RepoResult<CreateBillingInvoiceRow> {
  throw new Error("not implemented");
}

export function updateById(
  _client: DbClient,
  _params: UpdateBillingInvoiceByIdParams,
): RepoResult<UpdateBillingInvoiceByIdRow> {
  throw new Error("not implemented");
}
