import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import {
  extractBillingMissingTables,
  isBillingMissingTableError,
  markBillingTablesMissing,
  toBillingFeatureDisabledErrorBody,
} from "@/lib/billing/schema-guard";
import {
  createBillingInvoice,
  type CreateBillingInvoicePayload,
} from "@/lib/services/billing-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateBillingInvoicePayload | null;

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
      return NextResponse.json({ error: "Gecersiz istek govdesi." }, { status: 400 });
    }

    const result = await createBillingInvoice(auth.supabase, {
      userId: auth.user.id,
      payload,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (isBillingMissingTableError(error, ["billing_subscriptions", "billing_invoices"])) {
      const missingTables = extractBillingMissingTables(error, [
        "billing_subscriptions",
        "billing_invoices",
      ]);
      markBillingTablesMissing(missingTables);
      return NextResponse.json(toBillingFeatureDisabledErrorBody(missingTables), { status: 503 });
    }

    logApiError({
      route: "/api/billing/invoices",
      method: "POST",
      userId,
      error,
      message: "Billing invoice create request failed unexpectedly",
    });
    return NextResponse.json({ error: "Fatura istegi islenemedi." }, { status: 500 });
  }
}

