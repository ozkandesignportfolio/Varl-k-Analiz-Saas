import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { enrichServiceMediaNotes, type ServiceMediaUploadPayload } from "@/lib/service-media/ai-enrichment";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const DEFAULT_BATCH_LIMIT = 3;
const MAX_BATCH_LIMIT = 10;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 3;

type ClaimedJobRow = {
  id: string;
  user_id: string;
  asset_id: string;
  service_log_id: string;
  attempts: number;
  max_attempts: number;
  payload: unknown;
};

type JobPayload = {
  serviceType: string;
  serviceDate: string;
  provider: string | null;
  userNotes: string | null;
  existingNotes: string | null;
  uploads: ServiceMediaUploadPayload[];
};

type ServiceLogNotesRow = {
  id: string;
  notes: string | null;
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.slice(0, 2_000);
  }
  return "Bilinmeyen enrichment hatasi.";
};

const parsePayload = (payload: unknown): JobPayload | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const serviceType = typeof source.serviceType === "string" ? source.serviceType.trim() : "";
  const serviceDate = typeof source.serviceDate === "string" ? source.serviceDate.trim() : "";
  const provider = typeof source.provider === "string" ? source.provider.trim() || null : null;
  const userNotes = typeof source.userNotes === "string" ? source.userNotes.trim() || null : null;
  const existingNotes = typeof source.existingNotes === "string" ? source.existingNotes.trim() || null : null;

  if (!serviceType || !serviceDate) {
    return null;
  }

  const uploadsRaw = Array.isArray(source.uploads) ? source.uploads : [];
  const uploads: ServiceMediaUploadPayload[] = [];

  for (const entry of uploadsRaw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const item = entry as Record<string, unknown>;
    const kind = item.kind;
    if (kind !== "photo" && kind !== "video" && kind !== "audio") {
      continue;
    }

    const fileName = typeof item.fileName === "string" ? item.fileName : "";
    const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
    const storagePath = typeof item.storagePath === "string" ? item.storagePath : "";
    const size = Number(item.size ?? 0);
    const metadataSource =
      item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, string | number | boolean | null>)
        : {};

    if (!fileName || !storagePath || !mimeType || !Number.isFinite(size) || size <= 0) {
      continue;
    }

    uploads.push({
      kind,
      fileName,
      mimeType,
      storagePath,
      size,
      metadata: metadataSource,
    });
  }

  return {
    serviceType,
    serviceDate,
    provider,
    userNotes,
    existingNotes,
    uploads,
  };
};

const getServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

type ServiceRoleClient = NonNullable<ReturnType<typeof getServiceRoleClient>>;

const buildRetryScheduleIso = (attempts: number) => {
  const baseDelaySeconds = Math.min(300, Math.max(15, attempts * 20));
  const jitterSeconds = Math.floor(Math.random() * 8);
  const next = new Date(Date.now() + (baseDelaySeconds + jitterSeconds) * 1_000);
  return next.toISOString();
};

async function markJobCompleted(client: ServiceRoleClient, jobId: string) {
  await client
    .from("service_media_enrichment_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", jobId);
}

async function markJobFailed(
  client: ServiceRoleClient,
  params: {
    jobId: string;
    attempts: number;
    maxAttempts: number;
    errorMessage: string;
  },
) {
  const isLastAttempt = params.attempts >= params.maxAttempts;
  await client
    .from("service_media_enrichment_jobs")
    .update(
      isLastAttempt
        ? {
            status: "failed",
            completed_at: new Date().toISOString(),
            last_error: params.errorMessage,
          }
        : {
            status: "retryable",
            scheduled_at: buildRetryScheduleIso(params.attempts),
            last_error: params.errorMessage,
          },
    )
    .eq("id", params.jobId);
}

async function processJob(
  client: ServiceRoleClient,
  job: ClaimedJobRow,
): Promise<{ id: string; status: "completed" | "retryable" | "failed"; warningCount: number; error?: string }> {
  const payload = parsePayload(job.payload);
  if (!payload) {
    const errorMessage = "Job payload gecersiz.";
    await markJobFailed(client, {
      jobId: job.id,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      errorMessage,
    });
    return {
      id: job.id,
      status: job.attempts >= job.max_attempts ? "failed" : "retryable",
      warningCount: 0,
      error: errorMessage,
    };
  }

  try {
    const { data: serviceLog, error: serviceLogError } = await client
      .from("service_logs")
      .select("id,notes")
      .eq("id", job.service_log_id)
      .eq("user_id", job.user_id)
      .maybeSingle();

    if (serviceLogError || !serviceLog) {
      throw new Error("Servis kaydi bulunamadi.");
    }

    const resolvedServiceLog = serviceLog as ServiceLogNotesRow;
    const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

    const enrichment = await enrichServiceMediaNotes({
      apiKey: openAiApiKey,
      serviceType: payload.serviceType,
      serviceDate: payload.serviceDate,
      provider: payload.provider,
      userNotes: payload.userNotes,
      existingNotes: payload.existingNotes ?? resolvedServiceLog.notes,
      uploads: payload.uploads,
      downloadFile: async (storagePath) => {
        const downloadRes = await client.storage.from(STORAGE_BUCKET).download(storagePath);
        if (downloadRes.error || !downloadRes.data) {
          return null;
        }
        return downloadRes.data;
      },
    });

    const currentNotes = (resolvedServiceLog.notes ?? "").trim();
    const nextNotes = (enrichment.updatedNotes ?? "").trim();

    if (nextNotes && nextNotes !== currentNotes) {
      const { error: updateError } = await client
        .from("service_logs")
        .update({
          notes: enrichment.updatedNotes,
        })
        .eq("id", job.service_log_id)
        .eq("user_id", job.user_id);

      if (updateError) {
        throw new Error("AI notlari servis kaydina yazilamadi.");
      }

      logAuditEvent({
        route: "/api/service-media/jobs",
        userId: job.user_id,
        entityType: "service_logs",
        entityId: job.service_log_id,
        action: "update",
        meta: { fields: ["notes"], source: "ai_media_enrichment_job", warningCount: enrichment.warnings.length },
      });
    }

    await markJobCompleted(client, job.id);
    return {
      id: job.id,
      status: "completed",
      warningCount: enrichment.warnings.length,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    await markJobFailed(client, {
      jobId: job.id,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      errorMessage,
    });
    return {
      id: job.id,
      status: job.attempts >= job.max_attempts ? "failed" : "retryable",
      warningCount: 0,
      error: errorMessage,
    };
  }
}

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as
    | {
        limit?: unknown;
        concurrency?: unknown;
      }
    | null;

export async function POST(request: Request) {
  const jobSecret = process.env.SERVICE_MEDIA_JOB_SECRET?.trim();
  if (!jobSecret) {
    return NextResponse.json({ error: "SERVICE_MEDIA_JOB_SECRET tanimli degil." }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-job-secret")?.trim();
  if (!providedSecret || providedSecret !== jobSecret) {
    return NextResponse.json({ error: "Yetkisiz job istegi." }, { status: 401 });
  }

  const serviceRoleClient = getServiceRoleClient();
  if (!serviceRoleClient) {
    return NextResponse.json({ error: "Service role baglantisi kurulamadi." }, { status: 503 });
  }

  try {
    const body = await readBody(request);
    const batchLimit = Math.max(
      1,
      Math.min(MAX_BATCH_LIMIT, Math.floor(Number(body?.limit ?? DEFAULT_BATCH_LIMIT))),
    );
    const concurrency = Math.max(
      1,
      Math.min(MAX_CONCURRENCY, Math.floor(Number(body?.concurrency ?? DEFAULT_CONCURRENCY))),
    );

    const { data: claimedJobs, error: claimError } = await serviceRoleClient.rpc(
      "claim_service_media_enrichment_jobs",
      { p_limit: batchLimit },
    );

    if (claimError) {
      return NextResponse.json({ error: `Job claim basarisiz: ${claimError.message}` }, { status: 500 });
    }

    const jobs = ((claimedJobs ?? []) as ClaimedJobRow[]) ?? [];
    if (jobs.length === 0) {
      return NextResponse.json({
        ok: true,
        claimed: 0,
        processed: 0,
        completed: 0,
        retryable: 0,
        failed: 0,
      });
    }

    const results = await mapWithConcurrency(jobs, concurrency, async (job) => processJob(serviceRoleClient, job));
    const completed = results.filter((item) => item.status === "completed").length;
    const retryable = results.filter((item) => item.status === "retryable").length;
    const failed = results.filter((item) => item.status === "failed").length;

    return NextResponse.json({
      ok: true,
      claimed: jobs.length,
      processed: results.length,
      completed,
      retryable,
      failed,
      results,
    });
  } catch (error) {
    logApiError({
      route: "/api/service-media/jobs",
      method: "POST",
      userId: null,
      error,
      message: "Service media enrichment worker failed unexpectedly",
    });
    return NextResponse.json({ error: "Job worker beklenmeyen sekilde hata verdi." }, { status: 500 });
  }
}
