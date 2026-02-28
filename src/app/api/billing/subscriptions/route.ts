import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import {
  extractBillingMissingTables,
  isBillingMissingTableError,
  markBillingTablesMissing,
  toBillingFeatureDisabledErrorBody,
} from "@/lib/billing/schema-guard";
import { enforceLimit, isPlanLimitError, toPlanLimitErrorBody } from "@/lib/plans/limit-enforcer";
import {
  createBillingSubscription,
  type CreateBillingSubscriptionPayload,
} from "@/lib/services/billing-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateBillingSubscriptionPayload | null;

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const payload = await readBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    await enforceLimit({
      client: auth.supabase,
      userId: auth.user.id,
      profilePlan: auth.profilePlan,
      resource: "subscriptions",
      delta: 1,
    });

    const result = await createBillingSubscription(auth.supabase, {
      userId: auth.user.id,
      payload,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (isPlanLimitError(error)) {
      return NextResponse.json(toPlanLimitErrorBody(error), { status: 403 });
    }

    if (isBillingMissingTableError(error, ["billing_subscriptions"])) {
      const missingTables = extractBillingMissingTables(error, ["billing_subscriptions"]);
      markBillingTablesMissing(missingTables);
      return NextResponse.json(toBillingFeatureDisabledErrorBody(missingTables), { status: 503 });
    }

    logApiError({
      route: "/api/billing/subscriptions",
      method: "POST",
      userId,
      error,
      message: "Billing subscription create request failed unexpectedly",
    });
    return NextResponse.json({ error: "Abonelik isteği işlenemedi." }, { status: 500 });
  }
}
