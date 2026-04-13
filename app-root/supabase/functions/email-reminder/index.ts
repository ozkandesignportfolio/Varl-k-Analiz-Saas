import { createClient } from "npm:@supabase/supabase-js@2.95.3";

// Environment configuration
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const cronSecret = Deno.env.get("EMAIL_REMINDER_CRON_SECRET") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const fromEmail = Deno.env.get("AUTOMATION_FROM_EMAIL") ?? "";
const appUrl = Deno.env.get("APP_URL") ?? Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "";

// Constants
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

// Validation
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Types
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

// Constants
const RESEND_API_URL = "https://api.resend.com/emails";
const VERIFICATION_REDIRECT_URL = "https://www.assetly.network/auth/callback";

// Utility functions
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function resolveBatchSize(input: unknown): number {
  const value = Number(input);
  if (Number.isFinite(value) && value > 0 && value <= 500) {
    return Math.floor(value);
  }
  return 50; // Default batch size
}

function resolveMinAgeInterval(input: unknown): string {
  const value = String(input ?? "").trim();
  if (/^\d+\s*(minutes?|hours?|days?)$/i.test(value)) {
    return value;
  }
  return "10 minutes"; // Default: users created more than 10 minutes ago
}

function resolveCooldownInterval(input: unknown): string {
  const value = String(input ?? "").trim();
  if (/^\d+\s*(hours?|days?)$/i.test(value)) {
    return value;
  }
  return "24 hours"; // Default: 1 reminder per 24 hours
}

// Escape HTML for email safety
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Build verification email link
function buildVerificationLink(_email: string): string | null {
  // REQUIREMENT: Email link MUST use https://www.assetly.network/auth/callback
  return VERIFICATION_REDIRECT_URL;
}

// Build reminder email content
function buildReminderEmail(email: string): { subject: string; html: string; text: string } {
  const verificationLink = buildVerificationLink(email);
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

// Send email via Resend API
async function sendReminderEmail(
  to: string,
  content: { subject: string; html: string; text: string }
): Promise<{ success: boolean; error?: string; providerId?: string }> {
  if (!resendApiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  if (!fromEmail) {
    return { success: false, error: "AUTOMATION_FROM_EMAIL not configured" };
  }

  // Validate from email domain
  if (INVALID_DOMAINS.some(d => fromEmail.toLowerCase().includes(d))) {
    return {
      success: false,
      error: `Geçersiz gönderen e-posta: ${INVALID_DOMAINS.join(", ")} domainleri reddedildi.`,
    };
  }

  logEmailAttempt(to, fromEmail);

  const body = JSON.stringify({
    from: `Assetly <${fromEmail}>`,
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  const sendPromise = fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json; charset=utf-8",
    },
    body,
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
        error: `Resend API error ${response.status}: ${errorBody}` 
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
    const errorMsg = error instanceof Error ? error.message : "Unknown error sending email";
    logEmailFailed(to, "exception", errorMsg);
    return { 
      success: false, 
      error: errorMsg 
    };
  }
}

// Log reminder attempt to database
async function logReminderAttempt(
  userId: string,
  email: string,
  status: "attempt" | "success" | "failed",
  errorMessage?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc("log_email_reminder", {
    p_user_id: userId,
    p_email: email,
    p_reminder_type: "verification_reminder",
    p_status: status,
    p_error_message: errorMessage ?? null,
  });

  if (error) {
    console.error("[email-reminder] Failed to log reminder:", error);
    return null;
  }

  return data as string;
}

// Find unverified users needing reminders
async function findUnverifiedUsers(
  minAgeInterval: string,
  cooldownInterval: string,
  limit: number
): Promise<ReminderUser[]> {
  const { data, error } = await supabase.rpc("find_unverified_users_for_reminder", {
    p_min_age_interval: minAgeInterval,
    p_reminder_cooldown: cooldownInterval,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to find unverified users: ${error.message}`);
  }

  return (data as ReminderUser[]) ?? [];
}

// Process a single user reminder
async function processUserReminder(user: ReminderUser): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  // Validate email config before attempting
  if (!fromEmail || INVALID_DOMAINS.some(d => fromEmail.toLowerCase().includes(d))) {
    const errorMsg = `Geçersiz AUTOMATION_FROM_EMAIL: ${fromEmail || "boş"}`;
    
    console.error(
      JSON.stringify({
        event: "EMAIL_REMINDER_FAILED",
        user_id: user.user_id,
        email: user.email,
        error: errorMsg,
        duration_ms: Date.now() - startTime,
        ts: new Date().toISOString(),
      })
    );

    return {
      user_id: user.user_id,
      email: user.email,
      status: "failed",
      error: errorMsg,
    };
  }

  // Log attempt first
  await logReminderAttempt(user.user_id, user.email, "attempt");
  
  console.log(
    JSON.stringify({
      event: "EMAIL_REMINDER_ATTEMPT",
      user_id: user.user_id,
      email: user.email,
      ts: new Date().toISOString(),
    })
  );

  // Build and send email
  const emailContent = buildReminderEmail(user.email);
  const sendResult = await sendReminderEmail(user.email, emailContent);

  if (!sendResult.success) {
    // Log failure
    await logReminderAttempt(user.user_id, user.email, "failed", sendResult.error);
    
    console.error(
      JSON.stringify({
        event: "EMAIL_REMINDER_FAILED",
        user_id: user.user_id,
        email: user.email,
        error: sendResult.error,
        duration_ms: Date.now() - startTime,
        ts: new Date().toISOString(),
      })
    );

    return {
      user_id: user.user_id,
      email: user.email,
      status: "failed",
      error: sendResult.error,
    };
  }

  // Log success
  const logId = await logReminderAttempt(user.user_id, user.email, "success");

  console.log(
    JSON.stringify({
      event: "EMAIL_REMINDER_SUCCESS",
      user_id: user.user_id,
      email: user.email,
      log_id: logId,
      duration_ms: Date.now() - startTime,
      ts: new Date().toISOString(),
    })
  );

  return {
    user_id: user.user_id,
    email: user.email,
    status: "success",
    log_id: logId ?? undefined,
  };
}

// Main handler
Deno.serve(async (request) => {
  // Validate method
  if (request.method !== "POST") {
    return json({ error: "Only POST is allowed." }, 405);
  }

  // Validate cron secret
  if (!cronSecret) {
    return json({ error: "EMAIL_REMINDER_CRON_SECRET is not configured." }, 503);
  }

  const providedCronSecret = request.headers.get("x-cron-secret");
  if (!providedCronSecret) {
    return json({ error: "Missing x-cron-secret header." }, 401);
  }

  if (providedCronSecret !== cronSecret) {
    return json({ error: "Invalid x-cron-secret." }, 403);
  }

  // Validate Resend configuration
  if (!resendApiKey || !fromEmail || !appUrl) {
    return json({
      error: "Missing required configuration",
      missing: [
        !resendApiKey && "RESEND_API_KEY",
        !fromEmail && "AUTOMATION_FROM_EMAIL",
        !appUrl && "APP_URL|NEXT_PUBLIC_APP_URL",
      ].filter(Boolean),
    }, 503);
  }

  // Parse request body
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
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
      event: "email_reminder_job_start",
      ts: new Date().toISOString(),
      batch_size: batchSize,
      min_age_interval: minAgeInterval,
      cooldown_interval: cooldownInterval,
      dry_run: dryRun,
    })
  );

  try {
    // Find users needing reminders
    const users = await findUnverifiedUsers(minAgeInterval, cooldownInterval, batchSize);

    if (users.length === 0) {
      console.log(
        JSON.stringify({
          event: "email_reminder_no_users",
          ts: new Date().toISOString(),
        })
      );

      return json({
        processed: 0,
        success: 0,
        failed: 0,
        dry_run: dryRun,
        users: [],
      });
    }

    // Dry run: return users without sending
    if (dryRun) {
      return json({
        processed: users.length,
        success: 0,
        failed: 0,
        dry_run: true,
        users: users.map((u) => ({ user_id: u.user_id, email: u.email })),
      });
    }

    // Process reminders
    const results: ProcessingResult[] = [];
    for (const user of users) {
      const result = await processUserReminder(user);
      results.push(result);
    }

    // Build summary
    const summary = {
      processed: results.length,
      success: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      dry_run: false,
      users: results.map((r) => ({
        user_id: r.user_id,
        email: r.email,
        status: r.status,
        ...(r.error && { error: r.error }),
      })),
    };

    console.log(
      JSON.stringify({
        event: "email_reminder_job_complete",
        ts: new Date().toISOString(),
        summary: {
          processed: summary.processed,
          success: summary.success,
          failed: summary.failed,
        },
      })
    );

    return json(summary);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    
    console.error(
      JSON.stringify({
        event: "email_reminder_job_error",
        ts: new Date().toISOString(),
        error: errorMessage,
      })
    );

    return json({ error: errorMessage }, 500);
  }
});
