import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListBillingSubscriptionsByUserParams = {
  userId: string;
};

export type ListBillingSubscriptionsByUserRow = Pick<
  Row<"billing_subscriptions">,
  | "id"
  | "provider_name"
  | "subscription_name"
  | "plan_name"
  | "billing_cycle"
  | "amount"
  | "currency"
  | "next_billing_date"
  | "auto_renew"
  | "status"
  | "notes"
  | "created_at"
>;

export type CreateBillingSubscriptionParams = {
  values: Insert<"billing_subscriptions">;
};

export type CreateBillingSubscriptionRow = Pick<Row<"billing_subscriptions">, "id">;

export type UpdateBillingSubscriptionByIdParams = {
  userId: string;
  subscriptionId: string;
  patch: Update<"billing_subscriptions">;
};

export type UpdateBillingSubscriptionByIdRow = Pick<Row<"billing_subscriptions">, "id">;

export function listByUser(
  _client: DbClient,
  _params: ListBillingSubscriptionsByUserParams,
): RepoResult<ListBillingSubscriptionsByUserRow[]> {
  throw new Error("not implemented");
}

export function create(
  _client: DbClient,
  _params: CreateBillingSubscriptionParams,
): RepoResult<CreateBillingSubscriptionRow> {
  throw new Error("not implemented");
}

export function updateById(
  _client: DbClient,
  _params: UpdateBillingSubscriptionByIdParams,
): RepoResult<UpdateBillingSubscriptionByIdRow> {
  throw new Error("not implemented");
}
