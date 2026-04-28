import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAllowedAppOrigins } from "@/lib/env/public-env";
import { ServerEnv } from "@/lib/env/server-env";

export const runtime = "nodejs";

// Environment configuration
const RESEND_API_URL = "https://api.resend.com/emails";
const VERIFICATION_REDIRECT_URL = "https://www.assetly.network/auth/callback";
const EMAIL_TIMEOUT_MS = 10_000;
const INVALID_DOMAINS = ["resend.dev", "example.com"];

// EMAIL_ATTEMPT log
const logEmailAttempt = (email: string, fromEmail: string) => {
  console.log("EMAIL_ATTEMPT", {
    email,
    fromEmail,
    ts: new Date().toISOString(),
  });
};

// EMAIL_SUCCESS log
const logEmailSuccess = (email: string, providerId?: string) => {
  console.log("EMAIL_SUCCESS", {
    email,
    providerId,
    ts: new Date().toISOString(),
  });
};

// EMAIL_FAILED log
const logEmailFailed = (email: string, reason: string, error: string) => {
  console.log("EMAIL_FAILED", {
    email,
    reason,
    error,
    ts: new Date().toISOString(),
  });
};

type ReminderUser = {
  user_id: string;
  email: string;
  created_at: string;
};

type ProcessingResult = {
  user_id: string;
  email: string;
  status: "success" | "failed" | "skipped";
  error?: string;
  log_id?: string;
};

// Configuration validation
class ConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing required configuration: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

function getRequiredConfig(): {
  supabaseUrl: string;
  serviceRoleKey: string;
  cronSecret: string;
  resendApiKey: string;
  fromEmail: string;
  appUrl: string;
} {
  const supabaseUrl = ServerEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = ServerEnv.EMAIL_REMINDER_CRON_SECRET ?? "";
  const resendApiKey = ServerEnv.RESEND_API_KEY;
  const fromEmail = ServerEnv.AUTOMATION_FROM_EMAIL;
  // Centralized env accessor; returns the first configured origin (server
  // or public). We still treat an empty result as a missing env below.
  const [appUrl] = getAllowedAppOrigins();

  const missing: string[] = [];
  const invalid: string[] = [];

  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!cronSecret) missing.push("EMAIL_REMINDER_CRON_SECRET");
  if (!resendApiKey) missing.push("RESEND_API_KEY");
  if (!fromEmail) {
    missing.push("AUTOMATION_FROM_EMAIL");
  } else if (INVALID_DOMAINS.some(d => fromEmail.toLowerCase().includes(d))) {
    invalid.push("AUTOMATION_FROM_EMAIL (geçersiz domain: resend.dev, example.com)");
  }
  if (!appUrl) missing.push("APP_URL|NEXT_PUBLIC_APP_URL");

  if (missing.length > 0 || invalid.length > 0) {
    throw new ConfigError([...missing, ...invalid]);
  }

  return {
    supabaseUrl: supabaseUrl!,
    serviceRoleKey: serviceRoleKey!,
    cronSecret,
    resendApiKey: resendApiKey!,
    fromEmail: fromEmail!,
    appUrl: appUrl!,
  };
}

function resolveBatchSize(input: unknown): number {
  const value = Number(input);
  if (Number.isFinite(value) && value > 0 && value <= 500) {
    return Math.floor(value);
  }
  return 50;
}

function resolveMinAgeInterval(input: unknown): string {
  const value = String(input ?? "").trim();
  if (/^\d+\s*(minutes?|hours?|days?)$/i.test(value)) {
    return value;
  }
  return "10 minutes";
}

function resolveCooldownInterval(input: unknown): string {
  const value = String(input ?? "").trim();
  if (/^\d+\s*(hours?|days?)$/i.test(value)) {
    return value;
  }
  return "24 hours";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildVerificationLink(_email: string, _appUrl: string): string | null {
  // REQUIREMENT: Email link MUST use https://www.assetly.network/auth/callback
  return VERIFICATION_REDIRECT_URL;
}

function buildReminderEmail(email: string, appUrl: string): { subject: string; html: string; text: string } {
  const verificationLink = buildVerificationLink(email, appUrl);
  const escapedEmail = escapeHtml(email);

  const subject = "Hesabınızı Doğrulayın - Assetly";

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hesap Doğrulama</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
    <table role="presentation" style="width:100%;border-collapse:collapse;background:#f8fafc;">
        <tr>
            <td align="center" style="padding:40px 20px;">
                <table role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding:40px 32px 24px;background:#0f172a;text-align:center;">
                            <img src="https://www.assetly.network/icons/icon-192-v2.png" alt="Assetly" style="height:56px;width:56px;display:block;margin:0 auto 12px;border-radius:12px;" />
                            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Assetly</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px;">
                            <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Hesabınızı Doğrulayın</h2>
                            <p style="margin:0 0 24px;color:#334155;line-height:1.6;">
                                Merhaba,
                            </p>
                            <p style="margin:0 0 24px;color:#334155;line-height:1.6;">
                                <strong>${escapedEmail}</strong> adresiyle kaydoldunuz ancak hesabınız henüz doğrulanmamış.
                            </p>
                            <p style="margin:0 0 24px;color:#334155;line-height:1.6;">
                                Varlıklarınızı yönetmeye başlamak için lütfen e-posta adresinizi doğrulayın.
                            </p>
                            ${verificationLink ? `
                            <table role="presentation" style="margin:32px 0;">
                                <tr>
                                    <td style="text-align:center;">
                                        <a href="${escapeHtml(verificationLink)}" 
                                           style="display:inline-block;padding:14px 28px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">
                                            Hesabımı Doğrula
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            ` : ""}
                            <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.5;">
                                Eğer bu kaydı siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
                            </p>
                            <p style="margin:16px 0 0;color:#64748b;font-size:14px;line-height:1.5;">
                                Doğrulama bağlantısı çalışmazsa, giriş yapma sayfasından yeni bir doğrulama e-postası isteyebilirsiniz.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;background:#f1f5f9;text-align:center;">
                            <p style="margin:0;color:#64748b;font-size:12px;">
                                Assetly - Varlık Yönetim Sistemi
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  const text = `Assetly - Hesap Doğrulama

Merhaba,

${email} adresiyle kaydoldunuz ancak hesabınız henüz doğrulanmamış.

Varlıklarınızı yönetmeye başlamak için lütfen e-posta adresinizi doğrulayın.

${verificationLink ? `Hesabınızı doğrulamak için: ${verificationLink}` : "Giriş yapma sayfasından yeni bir doğrulama e-postası isteyebilirsiniz."}

Eğer bu kaydı siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.

Assetly - Varlık Yönetim Sistemi`;

  return { subject, html, text };
}

async function sendReminderEmail(
  to: string,
  content: { subject: string; html: string; text: string },
  resendApiKey: string,
  fromEmail: string
): Promise<{ success: boolean; error?: string; providerId?: string }> {
  // Validate from email
  if (INVALID_DOMAINS.some(d => fromEmail.toLowerCase().includes(d))) {
    return {
      success: false,
      error: `Geçersiz gönderen e-posta: ${INVALID_DOMAINS.join(", ")} domainleri reddedildi.`,
    };
  }

  logEmailAttempt(to, fromEmail);

  const body = {
    from: `Assetly <${fromEmail}>`,
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  };

  const sendPromise = fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const timeoutPromise = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error("Email gönderim zaman aşımı (10s)")), EMAIL_TIMEOUT_MS)
  );

  try {
    const response = await Promise.race([sendPromise, timeoutPromise]);

    if (!response.ok) {
      const errorBody = await response.text();
      logEmailFailed(to, "resend_api_error", errorBody);
      return {
        success: false,
        error: `Resend API error ${response.status}: ${errorBody}`,
      };
    }

    const responseText = await response.text();
    let providerId: string | undefined;
    try {
      const parsed = JSON.parse(responseText) as { id?: string };
      providerId = parsed.id;
    } catch {
      // ignore parse error
    }

    logEmailSuccess(to, providerId);
    return { success: true, providerId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    logEmailFailed(to, "exception", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();

  // Log that the email reminder was triggered
  console.log("CRON STARTED");
  console.log("EMAIL_REMINDER_TRIGGERED", {
    ts: new Date().toISOString(),
    url: request.url,
  });

  try {
    // Validate configuration
    const config = getRequiredConfig();

    // Validate cron secret
    const providedCronSecret = request.headers.get("x-cron-secret") ??
      new URL(request.url).searchParams.get("cron_secret");

    if (!providedCronSecret) {
      return NextResponse.json({ error: "Missing x-cron-secret header or cron_secret query param" }, { status: 401 });
    }

    if (providedCronSecret !== config.cronSecret) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 403 });
    }

    // Parse request body
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // Resolve parameters
    const batchSize = resolveBatchSize(body.batch_size);
    const minAgeInterval = resolveMinAgeInterval(body.min_age_interval);
    const cooldownInterval = resolveCooldownInterval(body.cooldown_interval);
    const dryRun = body.dry_run === true;

    console.log(
      JSON.stringify({
        event: "EMAIL_REMINDER_CRON_START",
        ts: new Date().toISOString(),
        batch_size: batchSize,
        min_age_interval: minAgeInterval,
        cooldown_interval: cooldownInterval,
        dry_run: dryRun,
      })
    );

    // Initialize Supabase client with service role
    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Find unverified users needing reminders
    const { data: users, error: findError } = await supabase.rpc("find_unverified_users_for_reminder", {
      p_min_age_interval: minAgeInterval,
      p_reminder_cooldown: cooldownInterval,
      p_limit: batchSize,
    });

    if (findError) {
      throw new Error(`Failed to find unverified users: ${findError.message}`);
    }

    const reminderUsers = (users as ReminderUser[]) ?? [];

    if (reminderUsers.length === 0) {
      console.log(
        JSON.stringify({
          event: "EMAIL_REMINDER_CRON_NO_USERS",
          ts: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
      );

      return NextResponse.json({
        processed: 0,
        success: 0,
        failed: 0,
        dry_run: dryRun,
        users: [],
      });
    }

    // Dry run: return users without sending
    if (dryRun) {
      return NextResponse.json({
        processed: reminderUsers.length,
        success: 0,
        failed: 0,
        dry_run: true,
        users: reminderUsers.map((u) => ({ user_id: u.user_id, email: u.email })),
      });
    }

    // Process reminders
    const results: ProcessingResult[] = [];

    for (const user of reminderUsers) {
      const userStartTime = Date.now();

      // Log attempt
      await supabase.rpc("log_email_reminder", {
        p_user_id: user.user_id,
        p_email: user.email,
        p_reminder_type: "verification_reminder",
        p_status: "attempt",
        p_error_message: null,
      });

      console.log(
        JSON.stringify({
          event: "EMAIL_REMINDER_ATTEMPT",
          user_id: user.user_id,
          email: user.email,
          ts: new Date().toISOString(),
        })
      );

      // Build and send email
      const emailContent = buildReminderEmail(user.email, config.appUrl);
      const sendResult = await sendReminderEmail(
        user.email,
        emailContent,
        config.resendApiKey,
        config.fromEmail
      );

      if (!sendResult.success) {
        // Log failure
        await supabase.rpc("log_email_reminder", {
          p_user_id: user.user_id,
          p_email: user.email,
          p_reminder_type: "verification_reminder",
          p_status: "failed",
          p_error_message: sendResult.error ?? null,
        });

        console.error(
          JSON.stringify({
            event: "EMAIL_REMINDER_FAILED",
            user_id: user.user_id,
            email: user.email,
            error: sendResult.error,
            duration_ms: Date.now() - userStartTime,
            ts: new Date().toISOString(),
          })
        );

        results.push({
          user_id: user.user_id,
          email: user.email,
          status: "failed",
          error: sendResult.error,
        });

        continue;
      }

      // Log success
      const { data: logId } = await supabase.rpc("log_email_reminder", {
        p_user_id: user.user_id,
        p_email: user.email,
        p_reminder_type: "verification_reminder",
        p_status: "success",
        p_error_message: null,
      });

      console.log(
        JSON.stringify({
          event: "EMAIL_REMINDER_SUCCESS",
          user_id: user.user_id,
          email: user.email,
          log_id: logId,
          duration_ms: Date.now() - userStartTime,
          ts: new Date().toISOString(),
        })
      );

      results.push({
        user_id: user.user_id,
        email: user.email,
        status: "success",
        log_id: logId ?? undefined,
      });
    }

    // Build summary
    const summary = {
      processed: results.length,
      success: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      dry_run: false,
      duration_ms: Date.now() - startTime,
      users: results.map((r) => ({
        user_id: r.user_id,
        email: r.email,
        status: r.status,
        ...(r.error && { error: r.error }),
      })),
    };

    console.log(
      JSON.stringify({
        event: "EMAIL_REMINDER_CRON_COMPLETE",
        ts: new Date().toISOString(),
        summary: {
          processed: summary.processed,
          success: summary.success,
          failed: summary.failed,
          duration_ms: summary.duration_ms,
        },
      })
    );

    return NextResponse.json(summary);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";

    if (error instanceof ConfigError) {
      return NextResponse.json(
        {
          error: "Server misconfiguration",
          missing: error.missing,
        },
        { status: 503 }
      );
    }

    console.error(
      JSON.stringify({
        event: "EMAIL_REMINDER_CRON_ERROR",
        ts: new Date().toISOString(),
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })
    );

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
