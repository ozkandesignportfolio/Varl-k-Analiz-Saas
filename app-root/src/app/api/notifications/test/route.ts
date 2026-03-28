import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logApiError, logApiRequest } from "@/lib/api/logging";
import { generateTestNotifications } from "@/lib/notifications/generate-test-notifications";
import { requireRouteUser } from "@/lib/supabase/route-auth";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const startedAt = Date.now();
  let userId: string | null = null;

  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    userId = auth.user.id;

    const notifications = await generateTestNotifications(auth.user.id);

    logApiRequest({
      route: "/api/notifications/test",
      method: "POST",
      status: 201,
      durationMs: Date.now() - startedAt,
      userId: auth.user.id,
      requestId,
      meta: {
        generatedCount: notifications.length,
      },
    });

    return NextResponse.json({ ok: true, count: notifications.length }, { status: 201 });
  } catch (error) {
    logApiError({
      route: "/api/notifications/test",
      method: "POST",
      requestId,
      userId,
      error,
      message: "Test notifications request failed unexpectedly",
    });

    return NextResponse.json({ error: "Test bildirimleri oluşturulamadı." }, { status: 500 });
  }
}
