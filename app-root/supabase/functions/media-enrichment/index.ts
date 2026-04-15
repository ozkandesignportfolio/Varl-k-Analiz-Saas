import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openAiApiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
const openAiModel = Deno.env.get("OPENAI_MODEL")?.trim() || "gpt-4.1-mini";
const openAiTranscribeModel = Deno.env.get("OPENAI_TRANSCRIBE_MODEL")?.trim() || "gpt-4o-mini-transcribe";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STORAGE_BUCKET = "documents-private";
const MAX_BATCH_SIZE = 5;
const MAX_CONCURRENCY = 2;
const MAX_MEDIA_SIZE_BYTES = 25 * 1024 * 1024;
const OPENAI_TIMEOUT_MS = 12_000;
const OPENAI_RETRY_LIMIT = 3;
const JOB_RETRY_LIMIT = 3;
const SIGNED_URL_TTL_SECONDS = 60 * 10;

type QueueStatus = "queued" | "processing" | "succeeded" | "failed";
type MediaKind = "photo" | "video" | "audio";

type JobRow = {
  id: string;
  user_id: string;
  service_log_id: string;
  document_ids: string[];
  status: QueueStatus;
  attempts: number;
};

type ServiceLogRow = {
  id: string;
  user_id: string;
  service_type: string;
  service_date: string;
  provider: string | null;
  notes: string | null;
};

type DocumentRow = {
  id: string;
  user_id: string;
  service_log_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  file_size: number | null;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }
  return "Unknown worker error.";
}

function documentTypeToKind(documentType: string): MediaKind | null {
  if (documentType === "service_photo") return "photo";
  if (documentType === "service_video") return "video";
  if (documentType === "service_audio_note") return "audio";
  return null;
}

function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function normalizeResponseText(raw: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```[a-zA-Z0-9]*\s*/g, "").replace(/\s*```$/g, "").trim();
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  const normalized = normalizeResponseText(raw);
  if (!normalized) return null;
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function extractOpenAiOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const outputText = (payload as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  const chunks: string[] = [];
  for (const entry of output) {
    if (!entry || typeof entry !== "object") continue;
    const content = (entry as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const text = (item as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n").trim() : null;
}

function summarizeMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) return "-";
  const serialized = JSON.stringify(metadata);
  return serialized.length <= 300 ? serialized : `${serialized.slice(0, 297)}...`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffWithJitterMs(attempt: number) {
  const base = Math.min(1800, 300 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = OPENAI_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("request_timeout"), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenAiWithRetry(url: string, init: RequestInit) {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < OPENAI_RETRY_LIMIT; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, OPENAI_TIMEOUT_MS);
      lastResponse = response;
      if (response.ok || !isRetryableHttpStatus(response.status)) {
        return response;
      }
      lastError = new Error(`openai_http_${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < OPENAI_RETRY_LIMIT - 1) {
      await sleep(backoffWithJitterMs(attempt));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError instanceof Error ? lastError : new Error("openai_request_failed");
}

async function callOpenAiResponses(input: unknown, maxOutputTokens = 500) {
  if (!openAiApiKey) {
    return null;
  }

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.2,
      max_output_tokens: maxOutputTokens,
      input,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return extractOpenAiOutputText(payload);
}

async function transcribeAudioFromSignedUrl(params: {
  signedUrl: string;
  fileName: string;
  mimeType: string;
}) {
  if (!openAiApiKey) {
    return null;
  }

  const mediaResponse = await fetchWithTimeout(params.signedUrl, { method: "GET" }, OPENAI_TIMEOUT_MS);
  if (!mediaResponse.ok) {
    return null;
  }

  const blob = await mediaResponse.blob();
  const formData = new FormData();
  formData.append("model", openAiTranscribeModel);
  formData.append("language", "tr");
  formData.append("file", new File([blob], params.fileName, { type: params.mimeType || blob.type }));

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { text?: unknown } | null;
  const text = payload?.text;
  return typeof text === "string" ? text.trim() || null : null;
}

async function parsePhotoMetadata(photoSignedUrl: string) {
  const text = await callOpenAiResponses(
    [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Asagidaki servis fotografini teknik metadata ve servis baglami olarak JSON formatinda ozetle.",
              "Sadece JSON don.",
              'Beklenen alanlar: {"scene":"string","detected_items":"string[]","condition_signals":"string[]","possible_issue":"string|null","confidence":"low|medium|high"}',
            ].join("\n"),
          },
          { type: "input_image", image_url: photoSignedUrl },
        ],
      },
    ],
    500,
  );

  return parseJsonObject(text);
}

async function parseVideoMetadata(doc: DocumentRow) {
  const text = await callOpenAiResponses(
    [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Asagidaki video dosya bilgisini servis baglaminda parse et.",
              "Sadece JSON don.",
              'Beklenen alanlar: {"container":"string|null","capture_type":"string|null","service_tags":"string[]","manual_review_needed":boolean}',
              `Dosya adi: ${doc.file_name}`,
              `Dosya boyutu: ${doc.file_size ?? 0}`,
              `Dokuman id: ${doc.id}`,
            ].join("\n"),
          },
        ],
      },
    ],
    400,
  );

  return parseJsonObject(text);
}

async function suggestDescription(params: {
  serviceType: string;
  serviceDate: string;
  provider: string | null;
  existingNotes: string | null;
  transcription: string | null;
  photoMetadata: Record<string, unknown> | null;
  videoMetadata: Record<string, unknown> | null;
}) {
  if (!openAiApiKey) {
    const parts = [
      `${params.serviceDate} tarihinde ${params.serviceType} islemi kaydedildi.`,
      params.provider ? `Sağlayıcı: ${params.provider}.` : null,
      params.existingNotes ? `Not: ${params.existingNotes}.` : null,
    ].filter(Boolean);
    return parts.join(" ");
  }

  const text = await callOpenAiResponses(
    [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Bakim/servis gunlugu icin 1-2 cumlelik aciklama onerisi yaz.",
              "Yanit Turkce ve sade olsun. Sadece aciklama metni don.",
              `service_type: ${params.serviceType}`,
              `service_date: ${params.serviceDate}`,
              `provider: ${params.provider ?? "-"}`,
              `existing_notes: ${params.existingNotes ?? "-"}`,
              `audio_transcription: ${params.transcription ?? "-"}`,
              `photo_metadata: ${JSON.stringify(params.photoMetadata)}`,
              `video_metadata: ${JSON.stringify(params.videoMetadata)}`,
            ].join("\n"),
          },
        ],
      },
    ],
    220,
  );

  return text?.trim() || null;
}

function composeUpdatedNotes(params: {
  existingNotes: string | null;
  suggestedDescription: string | null;
  transcription: string | null;
  photoMetadata: Record<string, unknown> | null;
  videoMetadata: Record<string, unknown> | null;
}) {
  const sections: string[] = [];
  const baseNotes = params.existingNotes?.trim();
  if (baseNotes) sections.push(baseNotes);
  if (params.suggestedDescription) sections.push(`AI Aciklama Onerisi:\n${params.suggestedDescription}`);
  if (params.transcription) sections.push(`Ses Transkripsiyonu:\n${params.transcription}`);

  const mediaLines: string[] = [];
  if (params.photoMetadata) mediaLines.push(`photo: ${summarizeMetadata(params.photoMetadata)}`);
  if (params.videoMetadata) mediaLines.push(`video: ${summarizeMetadata(params.videoMetadata)}`);
  if (mediaLines.length > 0) sections.push(`Medya Metadata:\n${mediaLines.join("\n")}`);

  const merged = sections.join("\n\n").trim();
  return merged || null;
}

async function createSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

async function claimJobs(limit: number): Promise<JobRow[]> {
  const { data: queuedRows, error } = await supabase
    .from("media_enrichment_jobs")
    .select("id,user_id,service_log_id,document_ids,status,attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !queuedRows || queuedRows.length === 0) {
    return [];
  }

  const claimed: JobRow[] = [];
  for (const row of queuedRows as JobRow[]) {
    const nextAttempts = (row.attempts ?? 0) + 1;
    const { data: updated } = await supabase
      .from("media_enrichment_jobs")
      .update({
        status: "processing",
        attempts: nextAttempts,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id,user_id,service_log_id,document_ids,status,attempts")
      .maybeSingle();

    if (updated) {
      claimed.push(updated as JobRow);
    }
  }

  return claimed;
}

async function markSucceeded(jobId: string) {
  await supabase
    .from("media_enrichment_jobs")
    .update({
      status: "succeeded",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "processing");
}

async function markFailedOrRequeue(params: { jobId: string; attempts: number; errorMessage: string }) {
  const terminal = params.attempts >= JOB_RETRY_LIMIT;
  await supabase
    .from("media_enrichment_jobs")
    .update({
      status: terminal ? "failed" : "queued",
      last_error: params.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.jobId)
    .eq("status", "processing");
}

async function processJob(job: JobRow) {
  const documentIds = Array.isArray(job.document_ids)
    ? job.document_ids.filter((value): value is string => typeof value === "string" && Boolean(value))
    : [];

  if (documentIds.length === 0) {
    const message = "Job document_ids bos.";
    await markFailedOrRequeue({ jobId: job.id, attempts: job.attempts, errorMessage: message });
    return { id: job.id, status: job.attempts >= JOB_RETRY_LIMIT ? "failed" : "queued", error: message };
  }

  try {
    const { data: serviceLog, error: serviceLogError } = await supabase
      .from("service_logs")
      .select("id,user_id,service_type,service_date,provider,notes")
      .eq("id", job.service_log_id)
      .eq("user_id", job.user_id)
      .maybeSingle();

    if (serviceLogError || !serviceLog) {
      throw new Error("Servis kaydı bulunamadı.");
    }

    const { data: documents, error: documentsError } = await supabase
      .from("documents")
      .select("id,user_id,service_log_id,document_type,file_name,storage_path,file_size")
      .eq("user_id", job.user_id)
      .eq("service_log_id", job.service_log_id)
      .in("id", documentIds);

    if (documentsError) {
      throw new Error(documentsError.message);
    }

    const docRows = ((documents ?? []) as DocumentRow[]).filter((doc) => {
      return documentIds.includes(doc.id) && doc.storage_path;
    });

    if (docRows.length === 0) {
      throw new Error("Job dokumanlari bulunamadi.");
    }

    const signedUrlByDocumentId = new Map<string, string>();
    for (const doc of docRows) {
      const fileSize = Number(doc.file_size ?? 0);
      if (fileSize > MAX_MEDIA_SIZE_BYTES) {
        continue;
      }
      const signedUrl = await createSignedUrl(doc.storage_path);
      if (signedUrl) {
        signedUrlByDocumentId.set(doc.id, signedUrl);
      }
    }

    const photoDoc = docRows.find((doc) => documentTypeToKind(doc.document_type) === "photo") ?? null;
    const videoDoc = docRows.find((doc) => documentTypeToKind(doc.document_type) === "video") ?? null;
    const audioDoc = docRows.find((doc) => documentTypeToKind(doc.document_type) === "audio") ?? null;

    let transcription: string | null = null;
    if (audioDoc) {
      const signedUrl = signedUrlByDocumentId.get(audioDoc.id);
      if (signedUrl) {
        transcription = await transcribeAudioFromSignedUrl({
          signedUrl,
          fileName: audioDoc.file_name,
          mimeType: "",
        });
      }
    }

    let photoMetadata: Record<string, unknown> | null = null;
    if (photoDoc) {
      const signedUrl = signedUrlByDocumentId.get(photoDoc.id);
      if (signedUrl) {
        photoMetadata = await parsePhotoMetadata(signedUrl);
      }
    }

    const videoMetadata = videoDoc ? await parseVideoMetadata(videoDoc) : null;
    const logRow = serviceLog as ServiceLogRow;
    const suggestedDescription = await suggestDescription({
      serviceType: logRow.service_type,
      serviceDate: logRow.service_date,
      provider: logRow.provider,
      existingNotes: logRow.notes,
      transcription,
      photoMetadata,
      videoMetadata,
    });

    const updatedNotes = composeUpdatedNotes({
      existingNotes: logRow.notes,
      suggestedDescription,
      transcription,
      photoMetadata,
      videoMetadata,
    });

    const previous = (logRow.notes ?? "").trim();
    const next = (updatedNotes ?? "").trim();
    if (next && next !== previous) {
      const { error: updateError } = await supabase
        .from("service_logs")
        .update({ notes: updatedNotes })
        .eq("id", logRow.id)
        .eq("user_id", logRow.user_id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    await markSucceeded(job.id);
    return { id: job.id, status: "succeeded" as const };
  } catch (error) {
    const message = toErrorMessage(error);
    await markFailedOrRequeue({
      jobId: job.id,
      attempts: job.attempts,
      errorMessage: message,
    });
    return {
      id: job.id,
      status: job.attempts >= JOB_RETRY_LIMIT ? ("failed" as const) : ("queued" as const),
      error: message,
    };
  }
}

async function mapWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TResult>,
) {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  const run = async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: safeConcurrency }, () => run()));
  return results;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Only POST is allowed." }, 405);
  }

  if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "Unauthorized." }, 401);
  }

  const claimedJobs = await claimJobs(MAX_BATCH_SIZE);
  if (claimedJobs.length === 0) {
    return json({
      ok: true,
      claimed: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      queued: 0,
    });
  }

  const results = await mapWithConcurrency(claimedJobs, MAX_CONCURRENCY, async (job) => processJob(job));
  const succeeded = results.filter((item) => item.status === "succeeded").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const queued = results.filter((item) => item.status === "queued").length;

  return json({
    ok: true,
    claimed: claimedJobs.length,
    processed: results.length,
    succeeded,
    failed,
    queued,
    results,
  });
});
