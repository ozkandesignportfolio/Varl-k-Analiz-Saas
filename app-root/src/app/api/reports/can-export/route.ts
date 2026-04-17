import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import { requireRouteUser } from "@/lib/supabase/route-auth";

/**
 * Server-side authoritative check for whether the current user is allowed to
 * export PDF reports. The client MUST call this endpoint before invoking
 * jsPDF; the frontend disabled-state is UX only and is bypassable via
 * devtools. Plan is resolved through `requireRouteUser`, which reads from
 * `app_metadata` / `profiles` only (never the user-writable `user_metadata`).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const planConfig = getPlanConfigFromProfilePlan(auth.profilePlan);
    const canExport = planConfig.features.canExportPdfReports === true;

    return NextResponse.json(
      {
        canExport,
        plan: auth.profilePlan,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    logApiError({
      route: "/api/reports/can-export",
      method: "GET",
      error,
      message: "Reports PDF export permission check failed",
    });
    return NextResponse.json({ error: "Permission check failed." }, { status: 500 });
  }
}
