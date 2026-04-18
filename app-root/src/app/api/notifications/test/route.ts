import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logApiError, logApiRequest } from "@/lib/api/logging";
import { getNotificationService, AppEventType } from "@/lib/notifications";
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

    const result = await getNotificationService().dispatch(
      { type: AppEventType.TEST_NOTIFICATION, userId: auth.user.id },
      { route: "/api/notifications/test", method: "POST" },
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: 500 },
      );
    }

    // Discriminated union daraltması — TEST_NOTIFICATION başarı varyantı.
    const successful = result.type === AppEventType.TEST_NOTIFICATION ? result.successful : 0;
    const failed = result.type === AppEventType.TEST_NOTIFICATION ? result.failed : 0;

    logApiRequest({
      route: "/api/notifications/test",
      method: "POST",
      status: 201,
      durationMs: Date.now() - startedAt,
      userId: auth.user.id,
      requestId,
      meta: { generatedCount: successful, failedCount: failed },
    });

    if (failed > 0 && successful === 0) {
      return NextResponse.json(
        { ok: false, error: "Test bildirimleri oluşturulamadı." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, count: successful, failed }, { status: 201 });
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
