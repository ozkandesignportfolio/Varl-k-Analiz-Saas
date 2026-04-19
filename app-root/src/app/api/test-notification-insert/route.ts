import "server-only";

import { NextResponse } from "next/server";
import { getNotificationService, AppEventType } from "@/lib/notifications";

/**
 * DEBUG TEST ROUTE - Force notification insert
 * GET /api/test-notification-insert?user_id=xxx
 * 
 * This route is for debugging only - directly tests notification insert
 * with explicit logging to verify RLS and schema issues.
 */
export async function GET(request: Request) {
  console.log("TEST_NOTIFICATION_INSERT_START", {
    url: request.url,
    ts: new Date().toISOString(),
  });

  try {
    // Get user_id from query param
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      console.log("TEST_NOTIFICATION_INSERT_ERROR", {
        error: "Missing user_id query parameter",
        ts: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Missing user_id query parameter. Use ?user_id=xxx" },
        { status: 400 }
      );
    }

    console.log("TEST_NOTIFICATION_INSERT_ATTEMPT", {
      userId,
      ts: new Date().toISOString(),
    });

    // Event contract üzerinden — debug route bile string literal kullanmaz.
    const result = await getNotificationService().dispatch(
      { type: AppEventType.USER_WELCOME, userId },
      { route: "/api/test-notification-insert", method: "GET" },
    );

    console.log("TEST_NOTIFICATION_INSERT_RESULT", {
      userId,
      result,
      ts: new Date().toISOString(),
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code, userId },
        { status: 500 },
      );
    }

    const notificationId =
      result.type === AppEventType.USER_WELCOME ? result.notificationId : null;

    return NextResponse.json({
      success: true,
      userId,
      notificationId,
      message: "Notification inserted successfully",
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.log("TEST_NOTIFICATION_INSERT_EXCEPTION", {
      error: errorMsg,
      ts: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
