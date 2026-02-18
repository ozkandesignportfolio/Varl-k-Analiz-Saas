import type { PostgrestError } from "@supabase/supabase-js";
import type { DbClient, Insert, RepoResult, Row, Update } from "./_shared";

export type GetRuleByIdParams = {
  userId: string;
  ruleId: string;
};

export type GetRuleByIdRow = Row<"maintenance_rules">;

export type ListRulesForServicesPageParams = {
  userId: string;
};

export type ListRulesForServicesPageRow = Pick<
  Row<"maintenance_rules">,
  "id" | "asset_id" | "title" | "is_active" | "next_due_date"
>;

export type ListRulesForDashboardParams = {
  userId: string;
  onlyActive?: boolean;
};

export type ListRulesForDashboardRow = Pick<
  Row<"maintenance_rules">,
  "id" | "asset_id" | "next_due_date" | "is_active"
>;

export type CreateRuleParams = {
  values: Insert<"maintenance_rules">;
};

export type CreateRuleRow = Pick<Row<"maintenance_rules">, "id">;

export type UpdateRuleByIdParams = {
  userId: string;
  ruleId: string;
  patch: Update<"maintenance_rules"> & { asset_id?: string };
};

export type UpdateRuleByIdRow = Pick<Row<"maintenance_rules">, "id">;

export function getById(
  client: DbClient,
  params: GetRuleByIdParams,
): RepoResult<GetRuleByIdRow> {
  const { ruleId, userId } = params;

  return Promise.resolve(
    client
      .from("maintenance_rules")
      .select(
        "id,asset_id,user_id,title,interval_value,interval_unit,last_service_date,next_due_date,is_active",
      )
      .eq("id", ruleId)
      .eq("user_id", userId)
      .single(),
  ).then((r) => ({
    data: (r.data as GetRuleByIdRow | null) ?? null,
    error: r.error,
  }));
}

export function create(
  client: DbClient,
  params: CreateRuleParams,
): RepoResult<CreateRuleRow> {
  const { values } = params;
  const table = client.from("maintenance_rules") as unknown as {
    insert: (insertValues: CreateRuleParams["values"]) => {
      select: (columns: "id") => {
        single: () => Promise<{ data: unknown; error: PostgrestError | null }>;
      };
    };
  };

  return Promise.resolve(
    table.insert(values).select("id").single(),
  ).then((r) => ({
    data: (r.data as CreateRuleRow | null) ?? null,
    error: r.error,
  }));
}

export function listForServicesPage(
  client: DbClient,
  params: ListRulesForServicesPageParams,
): RepoResult<ListRulesForServicesPageRow[]> {
  const { userId } = params;

  return Promise.resolve(
    client
      .from("maintenance_rules")
      .select("id,asset_id,title,is_active,next_due_date")
      .eq("user_id", userId)
      .order("next_due_date", { ascending: true }),
  ).then((r) => ({
    data: (r.data as ListRulesForServicesPageRow[] | null) ?? [],
    error: r.error,
  }));
}

export function listForDashboard(
  client: DbClient,
  params: ListRulesForDashboardParams,
): RepoResult<ListRulesForDashboardRow[]> {
  const { onlyActive = true, userId } = params;

  let query = client
    .from("maintenance_rules")
    .select("id,asset_id,next_due_date,is_active")
    .eq("user_id", userId)
    .order("next_due_date", { ascending: true });

  if (onlyActive) {
    query = query.eq("is_active", true);
  }

  return Promise.resolve(query).then((r) => ({
    data: (r.data as ListRulesForDashboardRow[] | null) ?? [],
    error: r.error,
  }));
}

export function updateById(
  client: DbClient,
  params: UpdateRuleByIdParams,
): RepoResult<UpdateRuleByIdRow> {
  const { patch, ruleId, userId } = params;
  const table = client.from("maintenance_rules") as unknown as {
    update: (updateValues: UpdateRuleByIdParams["patch"]) => {
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
      .eq("id", ruleId)
      .eq("user_id", userId)
      .select("id")
      .single(),
  ).then((r) => ({
    data: (r.data as UpdateRuleByIdRow | null) ?? null,
    error: r.error,
  }));
}
