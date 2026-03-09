import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { buildMessage, type AutomationEvent } from "./notification.ts";

export type EventActionResult = { ok: boolean; results: Record<string, unknown> };

async function sendEmailAction(supabase: SupabaseClient, event: AutomationEvent): Promise<Record<string, unknown>> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("AUTOMATION_FROM_EMAIL");
  if (!resendApiKey || !fromEmail) {
    return { status: "skipped", reason: "missing_resend_config" };
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(event.user_id);
  if (userError || !userData.user?.email) {
    return { status: "skipped", reason: "user_email_not_found" };
  }

  const message = buildMessage(event);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [userData.user.email],
      subject: message.title,
      text: message.body,
    }),
  });

  if (!response.ok) {
    throw new Error(`resend_error_${response.status}`);
  }

  const body = await response.json();
  return {
    status: "sent",
    to: userData.user.email,
    provider_id: body?.id ?? null,
  };
}

async function sendPushAction(supabase: SupabaseClient, event: AutomationEvent): Promise<Record<string, unknown>> {
  const { data: tokens, error } = await supabase
    .from("push_subscriptions")
    .select("token")
    .eq("user_id", event.user_id)
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  if (!tokens || tokens.length === 0) {
    return { status: "skipped", reason: "no_active_push_token" };
  }

  const message = buildMessage(event);
  const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN");

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
    },
    body: JSON.stringify(
      tokens.map((row) => ({
        to: row.token,
        sound: "default",
        title: message.title,
        body: message.body,
        data: {
          automation_event_id: event.id,
          trigger_type: event.trigger_type,
        },
      })),
    ),
  });

  if (!response.ok) {
    throw new Error(`push_error_${response.status}`);
  }

  const body = await response.json();
  return {
    status: "sent",
    token_count: tokens.length,
    provider_data: body?.data ?? null,
  };
}

async function buildPdfBytes(event: AutomationEvent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const nowIso = new Date().toISOString();
  const lines = [
    "Assetly Otomasyon Raporu",
    "",
    `Event ID: ${event.id}`,
    `Trigger: ${event.trigger_type}`,
    `User ID: ${event.user_id}`,
    `Asset ID: ${event.asset_id ?? "-"}`,
    `Rule ID: ${event.rule_id ?? "-"}`,
    `Service Log ID: ${event.service_log_id ?? "-"}`,
    `Generated At: ${nowIso}`,
    "",
    "Payload:",
    JSON.stringify(event.payload),
  ];

  let y = 800;
  for (const line of lines) {
    page.drawText(line, {
      x: 48,
      y,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: 500,
    });
    y -= 20;
  }

  return await pdf.save();
}

async function createPdfAction(supabase: SupabaseClient, event: AutomationEvent): Promise<Record<string, unknown>> {
  if (!event.asset_id) {
    return { status: "skipped", reason: "missing_asset_id" };
  }

  const bucket = Deno.env.get("AUTOMATION_REPORTS_BUCKET") ?? "documents-private";
  const pdfBytes = await buildPdfBytes(event);
  const fileName = `automation-${event.trigger_type}-${event.id}.pdf`;
  const storagePath = `${event.user_id}/${event.asset_id}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: documentError } = await supabase.from("documents").upsert(
    {
      user_id: event.user_id,
      asset_id: event.asset_id,
      service_log_id: event.service_log_id,
      document_type: "automation_report",
      file_name: fileName,
      storage_path: storagePath,
      file_size: pdfBytes.length,
    },
    { onConflict: "storage_path" },
  );
  if (documentError) {
    throw new Error(documentError.message);
  }

  return {
    status: "uploaded",
    bucket,
    storage_path: storagePath,
  };
}

export async function runEventActions(supabase: SupabaseClient, event: AutomationEvent): Promise<EventActionResult> {
  const results: Record<string, unknown> = {};
  let hasFailure = false;

  for (const action of event.actions) {
    try {
      if (action === "email") {
        results.email = await sendEmailAction(supabase, event);
      } else if (action === "push" || action === "push_notification") {
        results.push = await sendPushAction(supabase, event);
      } else if (action === "pdf_report") {
        results.pdf_report = await createPdfAction(supabase, event);
      }
    } catch (error) {
      hasFailure = true;
      results[action] = {
        status: "failed",
        error: error instanceof Error ? error.message : "unknown_error",
      };
    }
  }

  return { ok: !hasFailure, results };
}
