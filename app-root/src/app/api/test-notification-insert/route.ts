import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    // Direct insert with explicit logging
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        title: "TEST - Hoş geldiniz",
        message: "TEST - Hesabınız oluşturuldu",
        type: "Sistem",
        is_read: false,
      })
      .select();

    console.log("TEST_NOTIFICATION_INSERT_RESULT", {
      userId,
      data,
      error,
      errorMessage: error?.message ?? null,
      errorCode: error?.code ?? null,
      ts: new Date().toISOString(),
    });

    if (error) {
      console.log("TEST_NOTIFICATION_INSERT_FAILED", {
        userId,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        ts: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
        },
        { status: 500 }
      );
    }

    console.log("TEST_NOTIFICATION_INSERT_SUCCESS", {
      userId,
      notificationId: data?.[0]?.id ?? null,
      ts: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      userId,
      notification: data?.[0] ?? null,
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
