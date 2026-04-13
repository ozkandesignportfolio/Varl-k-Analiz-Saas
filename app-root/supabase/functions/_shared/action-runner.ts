import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.95.3";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import {
  buildEmailMessage,
  buildMessage,
  resolveNotificationPreferenceKey,
  type AutomationEvent,
} from "./notification.ts";
import { getEmailEnvState, requireEmailEnv } from "./email-env.ts";

export type EventActionResult = { ok: boolean; results: Record<string, unknown> };

type AssetContextRow = {
  id: string;
  name: string | null;
  category: string | null;
  warranty_end_date: string | null;
};

type NotificationPreferences = {
  maintenance: boolean;
  warranty: boolean;
  document: boolean;
  documentExpiry: boolean;
  service: boolean;
  payment: boolean;
  system: boolean;
  email: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  maintenance: true,
  warranty: true,
  document: true,
  documentExpiry: true,
  service: true,
  payment: true,
  system: true,
  email: true,
};

function logAutomation(level: "info" | "error", payload: Record<string, unknown>) {
  const entry = {
    level,
    event: "automation_dispatcher",
    ts: new Date().toISOString(),
    ...payload,
  };
  const logger = level === "error" ? console.error : console.log;
  logger(JSON.stringify(entry));
}

function toTrimmedString(value: unknown, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeAppUrl(value: string) {
  return isValidHttpUrl(value) ? value.replace(/\/+$/, "") : "";
}

function isConfiguredSecret(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const placeholderPatterns = [
    /^your[_-]/i,
    /^replace[_-]?me$/i,
    /^changeme$/i,
    /^placeholder$/i,
    /^example/i,
  ];

  return !placeholderPatterns.some((pattern) => pattern.test(normalized));
}

function maskSecret(value: string) {
  if (!value) {
    return "missing";
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function skipEmail(
  event: AutomationEvent,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  logAutomation("info", {
    action: "email_skipped",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    ...payload,
  });

  return {
    status: "skipped",
    ...payload,
  };
}

function failEmail(event: AutomationEvent, payload: Record<string, unknown>): never {
  const reason = toTrimmedString(payload.reason, "email_failed");

  logAutomation("error", {
    action: "email_failed",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    ...payload,
    reason,
  });

  throw new Error(reason);
}

function resolveMetadata(
  user: Pick<User, "user_metadata" | "app_metadata"> | null | undefined,
): Record<string, unknown> {
  const userMetadata =
    user?.user_metadata && typeof user.user_metadata === "object" && !Array.isArray(user.user_metadata)
      ? (user.user_metadata as Record<string, unknown>)
      : {};
  const appMetadata =
    user?.app_metadata && typeof user.app_metadata === "object" && !Array.isArray(user.app_metadata)
      ? (user.app_metadata as Record<string, unknown>)
      : {};

  return {
    ...appMetadata,
    ...userMetadata,
  };
}

function resolveNotificationPreferences(metadata: Record<string, unknown>): NotificationPreferences {
  const rawPrefs =
    (metadata.notification_preferences as Record<string, unknown> | undefined) ??
    (metadata.notificationPreferences as Record<string, unknown> | undefined) ??
    {};

  return {
    maintenance: toBoolean(rawPrefs.maintenance ?? rawPrefs.maintenance_email, defaultNotificationPreferences.maintenance),
    warranty: toBoolean(rawPrefs.warranty ?? rawPrefs.warranty_email, defaultNotificationPreferences.warranty),
    document: toBoolean(rawPrefs.document ?? rawPrefs.document_email, defaultNotificationPreferences.document),
    documentExpiry: toBoolean(
      rawPrefs.documentExpiry ?? rawPrefs.document_expiry ?? rawPrefs.document_expiry_email ?? rawPrefs.document,
      defaultNotificationPreferences.documentExpiry,
    ),
    service: toBoolean(
      rawPrefs.service ?? rawPrefs.service_logs ?? rawPrefs.service_log ?? rawPrefs.service_email,
      defaultNotificationPreferences.service,
    ),
    payment: toBoolean(rawPrefs.payment ?? rawPrefs.subscription_email, defaultNotificationPreferences.payment),
    system: toBoolean(rawPrefs.system ?? rawPrefs.general, defaultNotificationPreferences.system),
    email: toBoolean(rawPrefs.email, defaultNotificationPreferences.email),
  };
}

function resolveRecipientName(metadata: Record<string, unknown>, fallbackEmail: string) {
  const explicit =
    toTrimmedString(metadata.full_name) ||
    toTrimmedString(metadata.fullName) ||
    toTrimmedString(metadata.name);
  if (explicit) {
    return explicit;
  }

  const localPart = fallbackEmail.split("@")[0]?.trim();
  if (!localPart) {
    return "";
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveOrganizationName(metadata: Record<string, unknown>) {
  return (
    toTrimmedString(metadata.organization_name) ||
    toTrimmedString(metadata.organizationName) ||
    "AssetCare"
  );
}

function resolveAssetStatus(event: AutomationEvent, asset: AssetContextRow | null) {
  const explicitStatus = toTrimmedString(event.payload?.current_status);
  if (explicitStatus) {
    return explicitStatus;
  }

  if (event.trigger_type === "maintenance_7_days") {
    return "Bakim planlandi";
  }

  if (event.trigger_type === "warranty_30_days") {
    if (!asset?.warranty_end_date) {
      return "Garanti tarihi bekleniyor";
    }

    const warrantyDate = new Date(asset.warranty_end_date);
    if (Number.isNaN(warrantyDate.getTime())) {
      return "Garanti tarihi bekleniyor";
    }

    return warrantyDate.getTime() < Date.now() ? "Garanti bitti" : "Garanti aktif";
  }

  if (event.trigger_type === "subscription_due") {
    return "Odeme kontrolu gerekli";
  }

  if (event.trigger_type === "expense_threshold") {
    return "Kontrol bekliyor";
  }

  return "";
}

async function getAssetContext(
  supabase: SupabaseClient,
  event: AutomationEvent,
): Promise<AssetContextRow | null> {
  if (!event.asset_id) {
    return null;
  }

  const { data, error } = await supabase
    .from("assets")
    .select("id,name,category,warranty_end_date")
    .eq("id", event.asset_id)
    .maybeSingle();

  if (error) {
    logAutomation("error", {
      action: "asset_context_lookup_failed",
      event_id: event.id,
      asset_id: event.asset_id,
      error: error.message,
    });
    return null;
  }

  return (data as AssetContextRow | null) ?? null;
}

async function sendEmailAction(supabase: SupabaseClient, event: AutomationEvent): Promise<Record<string, unknown>> {
  const emailEnvState = getEmailEnvState();
  if (emailEnvState.missingEnv.length > 0) {
    logAutomation("error", {
      action: "email_env_invalid",
      event_id: event.id,
      user_id: event.user_id,
      trigger_type: event.trigger_type,
      missing_env: emailEnvState.missingEnv,
      app_url_source: emailEnvState.appUrlSource,
    });
    failEmail(event, {
      reason: "missing_email_env",
      missing_env: emailEnvState.missingEnv,
      app_url_source: emailEnvState.appUrlSource,
    });
  }

  const requiredEnv = requireEmailEnv();
  const resendApiKey = requiredEnv.RESEND_API_KEY;
  const fromEmail = requiredEnv.AUTOMATION_FROM_EMAIL;
  const replyToEmail = Deno.env.get("AUTOMATION_REPLY_TO_EMAIL")?.trim() ?? "";
  const serviceRoleKey = requiredEnv.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = normalizeAppUrl(requiredEnv.APP_URL);

  logAutomation("info", {
    action: "email_env_validation",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    resend_api_key_configured: isConfiguredSecret(resendApiKey),
    resend_api_key_masked: maskSecret(resendApiKey),
    from_email: fromEmail,
    reply_to_email: replyToEmail || null,
    app_url: appUrl,
    app_url_source: emailEnvState.appUrlSource,
    missing_env: emailEnvState.missingEnv,
    service_role_key_configured: isConfiguredSecret(serviceRoleKey),
  });

  if (!isConfiguredSecret(resendApiKey)) {
    failEmail(event, {
      reason: "invalid_resend_api_key",
    });
  }

  if (!fromEmail) {
    failEmail(event, {
      reason: "missing_from_email",
    });
  }

  if (!isValidEmail(fromEmail)) {
    failEmail(event, {
      reason: "invalid_sender_email",
      from_email: fromEmail,
    });
  }

  if (replyToEmail && !isValidEmail(replyToEmail)) {
    failEmail(event, {
      reason: "invalid_reply_to_email",
      reply_to_email: replyToEmail,
    });
  }

  if (!isConfiguredSecret(serviceRoleKey)) {
    failEmail(event, {
      reason: "invalid_supabase_service_role_key",
    });
  }

  if (!appUrl) {
    failEmail(event, {
      reason: "invalid_app_url",
    });
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(event.user_id);
  const user = userData.user;
  if (userError || !user?.email) {
    failEmail(event, {
      error: userError?.message ?? "missing_user_email",
      status: "lookup_failed",
      reason: "user_email_not_found",
    });
  }

  const recipientEmail = user.email.trim();
  if (!isValidEmail(recipientEmail)) {
    failEmail(event, {
      reason: "invalid_recipient_email",
      recipient_email: recipientEmail,
    });
  }

  const metadata = resolveMetadata(user);
  const preferences = resolveNotificationPreferences(metadata);
  const preferenceKey = resolveNotificationPreferenceKey(event);
  if (!preferences.email) {
    return skipEmail(event, {
      recipient_email: recipientEmail,
      reason: "email_channel_disabled",
      preference_key: preferenceKey,
      preference_value: false,
      preferences,
    });
  }

  if (!preferences[preferenceKey]) {
    return skipEmail(event, {
      recipient_email: recipientEmail,
      reason: "notification_type_disabled",
      preference_key: preferenceKey,
      preference_value: false,
      preferences,
    });
  }

  const asset = await getAssetContext(supabase, event);
  const emailMessage = buildEmailMessage(event, {
    appUrl,
    assetName: asset?.name ?? toTrimmedString(event.payload?.asset_name),
    assetCategory: asset?.category ?? toTrimmedString(event.payload?.asset_category),
    assetStatus: resolveAssetStatus(event, asset),
    organizationName: resolveOrganizationName(metadata),
    recipientName: resolveRecipientName(metadata, recipientEmail),
  });

  logAutomation("info", {
    action: "email_send_attempt",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    recipient_email: recipientEmail,
    from_email: fromEmail,
    reply_to_email: replyToEmail || null,
    preference_key: preferenceKey,
    preference_value: true,
    preferences,
    subject: emailMessage.subject,
    app_url: appUrl,
    payload: {
      to: [recipientEmail],
      subject: emailMessage.subject,
      has_text: Boolean(emailMessage.text),
      has_html: Boolean(emailMessage.html),
      cta_url: emailMessage.ctaUrl,
    },
  });

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json; charset=utf-8",
        "Idempotency-Key": `automation-email:${event.id}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: emailMessage.subject,
        text: emailMessage.text,
        html: emailMessage.html,
        ...(replyToEmail ? { reply_to: replyToEmail } : {}),
      }),
    });
  } catch (error) {
    failEmail(event, {
      reason: "resend_request_failed",
      recipient_email: recipientEmail,
      provider: "resend",
      error: error instanceof Error ? error.message : "unknown_error",
      preference_key: preferenceKey,
    });
  }

  const responseBody = await response.text();
  let parsedBody: Record<string, unknown> | null = null;
  if (responseBody) {
    try {
      parsedBody = JSON.parse(responseBody) as Record<string, unknown>;
    } catch {
      parsedBody = { raw: responseBody };
    }
  }

  if (!response.ok) {
    failEmail(event, {
      reason: "resend_provider_rejected",
      recipient_email: recipientEmail,
      status: response.status,
      provider: "resend",
      provider_response: parsedBody ?? responseBody,
      preference_key: preferenceKey,
    });
  }

  logAutomation("info", {
    action: "email_sent",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    recipient_email: recipientEmail,
    provider: "resend",
    provider_id: parsedBody?.id ?? null,
    preference_key: preferenceKey,
  });

  return {
    status: "sent",
    to: recipientEmail,
    provider: "resend",
    provider_id: parsedBody?.id ?? null,
    subject: emailMessage.subject,
    preference_key: preferenceKey,
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

  const asset = await getAssetContext(supabase, event);
  const message = buildMessage(event, {
    assetName: asset?.name ?? toTrimmedString(event.payload?.asset_name),
    assetCategory: asset?.category ?? toTrimmedString(event.payload?.asset_category),
    assetStatus: resolveAssetStatus(event, asset),
  });
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

  logAutomation("info", {
    action: "event_processing_started",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    actions: event.actions,
  });

  for (const action of event.actions) {
    try {
      if (action === "email") {
        results.email = await sendEmailAction(supabase, event);
      } else if (action === "push" || action === "push_notification") {
        results.push = await sendPushAction(supabase, event);
      } else if (action === "pdf_report") {
        results.pdf_report = await createPdfAction(supabase, event);
      } else {
        results[action] = { status: "skipped", reason: "unsupported_action" };
      }
    } catch (error) {
      hasFailure = true;
      const errorMessage = error instanceof Error ? error.message : "unknown_error";
      results[action] = {
        status: "failed",
        error: errorMessage,
      };
      logAutomation("error", {
        action: "event_action_failed",
        event_id: event.id,
        user_id: event.user_id,
        trigger_type: event.trigger_type,
        failed_action: action,
        error: errorMessage,
      });
    }
  }

  logAutomation("info", {
    action: "event_processing_finished",
    event_id: event.id,
    user_id: event.user_id,
    trigger_type: event.trigger_type,
    ok: !hasFailure,
    results,
  });

  return { ok: !hasFailure, results };
}
