import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type ListBillingSubscriptionsByUserParams = {
  userId: string;
};

export type GetBillingSubscriptionByIdParams = {
  userId: string;
  subscriptionId: string;
};

export type GetBillingSubscriptionByIdRow = Pick<
  Row<"billing_subscriptions">,
  | "id"
  | "user_id"
  | "maintenance_rule_id"
  | "billing_cycle"
  | "next_billing_date"
  | "auto_renew"
  | "status"
>;

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

export function getById(
  client: DbClient,
  params: GetBillingSubscriptionByIdParams,
): RepoResult<GetBillingSubscriptionByIdRow> {
  const { subscriptionId, userId } = params;

  return Promise.resolve(
    client
      .from("billing_subscriptions")
      .select("id,user_id,maintenance_rule_id,billing_cycle,next_billing_date,auto_renew,status")
      .eq("id", subscriptionId)
      .eq("user_id", userId)
      .maybeSingle(),
  ).then((r) => ({
    data: (r.data as GetBillingSubscriptionByIdRow | null) ?? null,
    error: r.error,
  }));
}

export function listByUser(
  client: DbClient,
  params: ListBillingSubscriptionsByUserParams,
): RepoResult<ListBillingSubscriptionsByUserRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("billing_subscriptions")
      .select(
        "id,provider_name,subscription_name,plan_name,billing_cycle,amount,currency,next_billing_date,auto_renew,status,notes,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ).then((r) => ({
    data: (r.data as ListBillingSubscriptionsByUserRow[] | null) ?? [],
    error: r.error,
  }));
}

export function create(
  client: DbClient,
  params: CreateBillingSubscriptionParams,
): RepoResult<CreateBillingSubscriptionRow> {
  const { values } = params;
  const table = client.from("billing_subscriptions") as unknown as {
    insert: (insertValues: CreateBillingSubscriptionParams["values"]) => {
      select: (columns: "id") => {
        single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
      };
    };
  };

  return Promise.resolve(
    table.insert(values).select("id").single(),
  ).then((r) => ({
    data: (r.data as CreateBillingSubscriptionRow | null) ?? null,
    error: r.error,
  }));
}

export function updateById(
  client: DbClient,
  params: UpdateBillingSubscriptionByIdParams,
): RepoResult<UpdateBillingSubscriptionByIdRow> {
  const { patch, subscriptionId, userId } = params;
  const table = client.from("billing_subscriptions") as unknown as {
    update: (updateValues: UpdateBillingSubscriptionByIdParams["patch"]) => {
      eq: (column: "id", value: string) => {
        eq: (userColumn: "user_id", userValue: string) => {
          select: (columns: "id") => {
            single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
          };
        };
      };
    };
  };

  return Promise.resolve(
    table
      .update(patch)
      .eq("id", subscriptionId)
      .eq("user_id", userId)
      .select("id")
      .single(),
  ).then((r) => ({
    data: (r.data as UpdateBillingSubscriptionByIdRow | null) ?? null,
    error: r.error,
  }));
}
