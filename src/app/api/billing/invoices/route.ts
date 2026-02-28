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
  createBillingInvoice,
  type CreateBillingInvoicePayload,
} from "@/lib/services/billing-service";
import { requireRouteUser } from "@/lib/supabase/route-auth";

type DeleteBillingInvoicePayload = {
  id?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as CreateBillingInvoicePayload | null;

const readDeleteBody = async (request: Request) =>
  (await request.json().catch(() => null)) as DeleteBillingInvoicePayload | null;

const normalizeUuid = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

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
      resource: "invoices",
      delta: 1,
    });

    const result = await createBillingInvoice(auth.supabase, {
      userId: auth.user.id,
      payload,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (isPlanLimitError(error)) {
      return NextResponse.json(toPlanLimitErrorBody(error), { status: 403 });
    }

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
    return NextResponse.json({ error: "Fatura isteği işlenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const payload = await readDeleteBody(request);
    const invoiceId = normalizeUuid(payload?.id ?? new URL(request.url).searchParams.get("id"));
    if (!invoiceId) {
      return NextResponse.json({ error: "Fatura kimliği geçersiz." }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("billing_invoices")
      .delete()
      .eq("id", invoiceId)
      .eq("user_id", auth.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (isBillingMissingTableError(error, ["billing_invoices"])) {
        const missingTables = extractBillingMissingTables(error, ["billing_invoices"]);
        markBillingTablesMissing(missingTables);
        return NextResponse.json(toBillingFeatureDisabledErrorBody(missingTables), { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: "Fatura bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  } catch (error) {
    if (isBillingMissingTableError(error, ["billing_invoices"])) {
      const missingTables = extractBillingMissingTables(error, ["billing_invoices"]);
      markBillingTablesMissing(missingTables);
      return NextResponse.json(toBillingFeatureDisabledErrorBody(missingTables), { status: 503 });
    }

    logApiError({
      route: "/api/billing/invoices",
      method: "DELETE",
      userId,
      error,
      message: "Billing invoice delete request failed unexpectedly",
    });
    return NextResponse.json({ error: "Fatura silme isteği işlenemedi." }, { status: 500 });
  }
}
