import type { DbClient } from "@/lib/repos/_shared";
import { normalizeProfilePlan, type ProfilePlan } from "@/lib/plans/profile-plan";

export type LimitResource = "assets" | "documents" | "subscriptions" | "invoices";

export type EnforceLimitParams = {
  client: DbClient;
  userId: string;
  resource: LimitResource;
  delta?: number;
  profilePlan?: ProfilePlan;
};

export type PlanLimitErrorPayload = {
  code: "PLAN_LIMIT";
  message_tr: string;
  resource: LimitResource;
  limit: number;
  current: number;
  delta: number;
};

const TABLE_BY_RESOURCE: Record<LimitResource, "assets" | "documents" | "billing_subscriptions" | "billing_invoices"> =
  {
    assets: "assets",
    documents: "documents",
    subscriptions: "billing_subscriptions",
    invoices: "billing_invoices",
  };

const FREE_LIMIT_BY_RESOURCE: Record<LimitResource, number> = {
  assets: 3,
  documents: 5,
  subscriptions: 3,
  invoices: 5,
};

const buildLimitMessageTr = (resource: LimitResource, limit: number) => {
  switch (resource) {
    case "assets":
      return `Free planda en fazla ${limit} varlık oluşturabilirsiniz.`;
    case "documents":
      return `Free planda en fazla ${limit} belge yükleyebilirsiniz.`;
    case "subscriptions":
      return `Free planda en fazla ${limit} abonelik oluşturabilirsiniz.`;
    case "invoices":
      return `Free planda en fazla ${limit} fatura oluşturabilirsiniz.`;
    default:
      return "Plan limitine ulaştınız.";
  }
};

export class PlanLimitError extends Error {
  code: "PLAN_LIMIT";
  message_tr: string;
  resource: LimitResource;
  limit: number;
  current: number;
  delta: number;

  constructor(payload: PlanLimitErrorPayload) {
    super(payload.message_tr);
    this.name = "PlanLimitError";
    this.code = payload.code;
    this.message_tr = payload.message_tr;
    this.resource = payload.resource;
    this.limit = payload.limit;
    this.current = payload.current;
    this.delta = payload.delta;
  }
}

export const isPlanLimitError = (error: unknown): error is PlanLimitError =>
  error instanceof PlanLimitError ||
  (typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "PLAN_LIMIT" &&
    typeof (error as { message_tr?: unknown }).message_tr === "string");

export const toPlanLimitErrorBody = (error: PlanLimitError | PlanLimitErrorPayload) => ({
  error: error.message_tr,
  code: "PLAN_LIMIT" as const,
  message_tr: error.message_tr,
});

const normalizeDelta = (delta: number | undefined) => {
  if (!Number.isFinite(delta)) return 1;
  const parsed = Math.floor(delta as number);
  return parsed > 0 ? parsed : 1;
};

const readProfilePlan = async (client: DbClient, userId: string) => {
  const query = client.from("profiles") as unknown as {
    select: (columns: "plan") => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<{
          data: { plan: string | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const response = await query.select("plan").eq("id", userId).maybeSingle();
  if (response.error) {
    throw new Error(`Plan bilgisi okunamadı: ${response.error.message}`);
  }

  return normalizeProfilePlan(response.data?.plan);
};

const countByResource = async (client: DbClient, userId: string, resource: LimitResource) => {
  const tableName = TABLE_BY_RESOURCE[resource];
  const query = client.from(tableName) as unknown as {
    select: (columns: "id", options: { count: "exact"; head: true }) => {
      eq: (column: "user_id", value: string) => Promise<{
        count: number | null;
        error: { message: string } | null;
      }>;
    };
  };

  const response = await query.select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (response.error) {
    throw new Error(`Limit sayımı başarısız: ${response.error.message}`);
  }

  return response.count ?? 0;
};

export async function enforceLimit(params: EnforceLimitParams): Promise<void> {
  const delta = normalizeDelta(params.delta);
  const profilePlan = params.profilePlan ?? (await readProfilePlan(params.client, params.userId));

  if (profilePlan === "premium") {
    return;
  }

  const limit = FREE_LIMIT_BY_RESOURCE[params.resource];
  const current = await countByResource(params.client, params.userId, params.resource);
  const projected = current + delta;

  if (projected <= limit) {
    return;
  }

  throw new PlanLimitError({
    code: "PLAN_LIMIT",
    message_tr: buildLimitMessageTr(params.resource, limit),
    resource: params.resource,
    limit,
    current,
    delta,
  });
}
