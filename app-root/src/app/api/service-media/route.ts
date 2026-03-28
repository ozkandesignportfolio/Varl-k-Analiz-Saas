import { randomUUID } from "crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { logApiError, logApiRequest, logAuditEvent } from "@/lib/api/logging";
import { enforceUserRateLimit } from "@/lib/api/rate-limit";
import { existsById } from "@/lib/repos/assets-repo";
import { enforceLimit, isPlanLimitError, toPlanLimitErrorBody } from "@/lib/plans/limit-enforcer";
import {
  buildMediaEnrichmentIdempotencyKey,
  queueMediaEnrichmentJob,
  type MediaEnrichmentJobStatus,
} from "@/lib/service-media/enrichment-jobs";
import { requireRouteUser, type RouteAuthSuccess } from "@/lib/supabase/route-auth";
import { fileConstraints, optionalText, parseDateOnly, uuid } from "@/lib/validation";
import { buildQueuedServiceMediaResponse } from "./response";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const MAX_SERVICE_TYPE_LENGTH = 120;
const MAX_PROVIDER_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;
const MAX_QUEUE_JOBS_PER_MINUTE = 20;
const UPLOAD_CONCURRENCY = 3;
const SERVICE_MEDIA_RATE_LIMIT_CAPACITY = 8;
const SERVICE_MEDIA_RATE_LIMIT_REFILL_PER_SECOND = SERVICE_MEDIA_RATE_LIMIT_CAPACITY / 60;

type MediaKind = "photo" | "video" | "audio";

type MediaUploadResult = {
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  metadata: Record<string, string | number | boolean | null>;
};

type QueueRow = {
  id: string;
  status: MediaEnrichmentJobStatus;
};

type UploadAttempt =
  | {
      ok: true;
      upload: MediaUploadResult;
      documentId: string;
      storagePath: string;
    }
  | {
      ok: false;
      error: string;
      orphanedStoragePath?: string;
    };

const allowedMimeTypes: Record<MediaKind, string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/webm",
    "audio/ogg",
  ],
};

const allowedExtensions: Record<MediaKind, string[]> = {
  photo: ["jpg", "jpeg", "png", "webp", "heic"],
  video: ["mp4", "mov", "qt", "webm", "mkv"],
  audio: ["mp3", "mpeg", "wav", "m4a", "mp4", "webm", "ogg"],
};

const compatibleExtensionsByMimeType: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov", "qt"],
  "video/webm": ["webm"],
  "video/x-matroska": ["mkv"],
  "audio/mpeg": ["mp3", "mpeg"],
  "audio/mp3": ["mp3"],
  "audio/wav": ["wav"],
  "audio/x-wav": ["wav"],
  "audio/mp4": ["m4a", "mp4"],
  "audio/m4a": ["m4a", "mp4"],
  "audio/webm": ["webm"],
  "audio/ogg": ["ogg"],
};

const documentTypeByKind: Record<MediaKind, string> = {
  photo: "service_photo",
  video: "service_video",
  audio: "service_audio_note",
};

const parseUuid = uuid();
const parseServiceTypeText = optionalText(MAX_SERVICE_TYPE_LENGTH);
const parseProviderText = optionalText(MAX_PROVIDER_LENGTH);
const parseNotesText = optionalText(MAX_NOTES_LENGTH);
const validatePhotoFile = fileConstraints("photo", Number.POSITIVE_INFINITY);
const validateVideoFile = fileConstraints("video", Number.POSITIVE_INFINITY);
const validateAudioFile = fileConstraints("audio", Number.POSITIVE_INFINITY);

function readFormText(
  formData: FormData,
  key: string,
  options: { required?: boolean; maxLength?: number } = {},
) {
  const entry = formData.get(key);
  const parser =
    options.maxLength === MAX_SERVICE_TYPE_LENGTH
      ? parseServiceTypeText
      : options.maxLength === MAX_PROVIDER_LENGTH
        ? parseProviderText
        : options.maxLength === MAX_NOTES_LENGTH
          ? parseNotesText
          : optionalText(options.maxLength ?? Number.MAX_SAFE_INTEGER);

  return parser(entry, { required: options.required });
}

function normalizeDisplayFileName(fileName: string) {
  const leafName = fileName.split(/[\\/]/).pop() ?? fileName;
  const trimmed = leafName.trim();
  return trimmed.slice(0, 255) || "media";
}

function sanitizeFileStem(fileName: string) {
  const leafName = normalizeDisplayFileName(fileName);
  const extensionIndex = leafName.lastIndexOf(".");
  const stem = extensionIndex > 0 ? leafName.slice(0, extensionIndex) : leafName;
  const asciiOnly = stem.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");

  const normalized = asciiOnly
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized.slice(0, 80) || "media";
}

function getFileEntry(formData: FormData, key: string) {
  const entry = formData.get(key);
  if (!(entry instanceof File)) {
    return null;
  }
  return entry.size > 0 ? entry : null;
}

function getExtension(fileName: string) {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return null;
  }
  return parts[parts.length - 1]?.toLowerCase().trim() ?? null;
}

function buildStoragePath(params: {
  userId: string;
  assetId: string;
  serviceLogId: string;
  fileName: string;
  extension: string;
  kind: MediaKind;
}) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const safeStem = sanitizeFileStem(params.fileName);
  const uniqueSuffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const objectName = `${params.kind}-${timestamp}-${uniqueSuffix}-${safeStem}.${params.extension}`;
  return path.posix.join(
    params.userId,
    params.assetId,
    "service-logs",
    params.serviceLogId,
    params.kind,
    objectName,
  );
}

function buildMetadata(file: File, mimeType: string) {
  return {
    mime_type: mimeType || null,
    extension: getExtension(file.name),
    size_bytes: file.size,
    last_modified_unix: file.lastModified || null,
  };
}

function validateMediaFile(file: File, kind: MediaKind) {
  const validate =
    kind === "photo" ? validatePhotoFile : kind === "video" ? validateVideoFile : validateAudioFile;

  return validate(file, {
    allowedMimeTypes: allowedMimeTypes[kind],
    allowedExtensions: allowedExtensions[kind],
    compatibleExtensionsByMimeType: compatibleExtensionsByMimeType,
  });
}

async function rollbackUploadBatch(params: {
  supabase: RouteAuthSuccess["supabase"];
  userId: string;
  insertedDocumentPaths: string[];
  orphanedStoragePaths: string[];
}) {
  const insertedDocumentPaths = [...new Set(params.insertedDocumentPaths)];
  const storagePathsToRemove = [...new Set([...insertedDocumentPaths, ...params.orphanedStoragePaths])];

  if (insertedDocumentPaths.length > 0) {
    await params.supabase
      .from("documents")
      .delete()
      .eq("user_id", params.userId)
      .in("storage_path", insertedDocumentPaths);
  }

  if (storagePathsToRemove.length > 0) {
    await params.supabase.storage.from(STORAGE_BUCKET).remove(storagePathsToRemove);
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

async function uploadSingleMedia(params: {
  supabase: RouteAuthSuccess["supabase"];
  userId: string;
  assetId: string;
  serviceLogId: string;
  entry: { kind: MediaKind; file: File; mimeType: string; extension: string };
}): Promise<UploadAttempt> {
  const storagePath = buildStoragePath({
    userId: params.userId,
    assetId: params.assetId,
    serviceLogId: params.serviceLogId,
    fileName: params.entry.file.name,
    extension: params.entry.extension,
    kind: params.entry.kind,
  });

  const { error: uploadError } = await params.supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, params.entry.file, { contentType: params.entry.mimeType, upsert: false });

  if (uploadError) {
    return {
      ok: false,
      error: `${params.entry.kind} dosyasi yuklenemedi.`,
    };
  }

  const { data: insertedDocument, error: docError } = await params.supabase
    .from("documents")
    .insert({
      asset_id: params.assetId,
      user_id: params.userId,
      service_log_id: params.serviceLogId,
      document_type: documentTypeByKind[params.entry.kind],
      file_name: normalizeDisplayFileName(params.entry.file.name),
      storage_path: storagePath,
      file_size: params.entry.file.size,
    })
    .select("id")
    .single();

  if (docError || !insertedDocument?.id) {
    await params.supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: `${params.entry.kind} dokuman kaydi olusturulamadi.`,
      orphanedStoragePath: storagePath,
    };
  }

  logAuditEvent({
    route: "/api/service-media",
    userId: params.userId,
    entityType: "documents",
    entityId: insertedDocument.id,
    action: "create",
    meta: { documentType: documentTypeByKind[params.entry.kind], serviceLogId: params.serviceLogId },
  });

  return {
    ok: true,
    documentId: insertedDocument.id,
    storagePath,
    upload: {
      kind: params.entry.kind,
      fileName: params.entry.file.name,
      mimeType: params.entry.mimeType,
      size: params.entry.file.size,
      storagePath,
      metadata: buildMetadata(params.entry.file, params.entry.mimeType),
    },
  };
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const startedAt = Date.now();
  let userId: string | null = null;
  let responseStatus = 500;
  let dbTimeMs = 0;

  const timeDb = async <T>(work: () => PromiseLike<T>) => {
    const started = Date.now();
    try {
      return await work();
    } finally {
      dbTimeMs += Date.now() - started;
    }
  };

  const finalize = <T extends NextResponse>(response: T) => {
    responseStatus = response.status;
    return response;
  };

  const respond = (body: unknown, init?: ResponseInit) => finalize(NextResponse.json(body, init));

  try {
    const auth = await timeDb(() => requireRouteUser(request));
    if ("response" in auth) {
      return finalize(auth.response);
    }

    const { supabase, user } = auth;
    userId = user.id;

    const rateLimit = await timeDb(() =>
      enforceUserRateLimit({
        client: supabase,
        scope: "api_service_media",
        userId: user.id,
        capacity: SERVICE_MEDIA_RATE_LIMIT_CAPACITY,
        refillPerSecond: SERVICE_MEDIA_RATE_LIMIT_REFILL_PER_SECOND,
        ttlSeconds: 180,
      }),
    );

    if (!rateLimit.allowed) {
      return respond(
        { error: "Cok fazla medya istegi gonderildi. Lutfen biraz bekleyip tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return respond({ error: "Gecersiz form verisi." }, { status: 400 });
    }

    const assetIdField = readFormText(formData, "assetId", { required: true });
    const serviceLogIdField = readFormText(formData, "serviceLogId", { required: true });
    const serviceTypeField = readFormText(formData, "serviceType", {
      required: true,
      maxLength: MAX_SERVICE_TYPE_LENGTH,
    });
    const serviceDateField = readFormText(formData, "serviceDate", { required: true });
    const providerField = readFormText(formData, "provider", { maxLength: MAX_PROVIDER_LENGTH });
    const userNotesField = readFormText(formData, "notes", { maxLength: MAX_NOTES_LENGTH });

    if (assetIdField.invalidType || serviceLogIdField.invalidType) {
      return respond({ error: "Varlik veya servis kaydi kimligi gecersiz." }, { status: 400 });
    }

    if (
      serviceTypeField.invalidType ||
      serviceDateField.invalidType ||
      providerField.invalidType ||
      userNotesField.invalidType
    ) {
      return respond({ error: "Metin alanlari gecersiz." }, { status: 400 });
    }

    if (serviceTypeField.tooLong) {
      return respond({ error: "Servis turu cok uzun." }, { status: 400 });
    }

    if (providerField.tooLong) {
      return respond({ error: "Saglayici bilgisi cok uzun." }, { status: 400 });
    }

    if (userNotesField.tooLong) {
      return respond({ error: "Not alani cok uzun." }, { status: 400 });
    }

    const assetId = parseUuid(assetIdField.value);
    const serviceLogId = parseUuid(serviceLogIdField.value);
    const serviceType = serviceTypeField.value;
    const serviceDate = serviceDateField.value;
    if (!assetId || !serviceLogId) {
      return respond({ error: "Varlik veya servis kaydi kimligi gecersiz." }, { status: 400 });
    }

    if (!serviceType || !serviceDate) {
      return respond({ error: "Zorunlu alanlar eksik." }, { status: 400 });
    }

    if (!parseDateOnly(serviceDate)) {
      return respond({ error: "Servis tarihi gecersiz." }, { status: 400 });
    }

    const oneMinuteAgoIso = new Date(Date.now() - 60_000).toISOString();
    const recentJobsResult = (await timeDb(() =>
      supabase
        .from("media_enrichment_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", oneMinuteAgoIso),
    )) as {
      count: number | null;
      error: { message?: string } | null;
    };
    if (recentJobsResult.error) {
      return respond({ error: recentJobsResult.error.message ?? "Islem gecici olarak tamamlanamadi." }, { status: 400 });
    }
    const recentJobCount = recentJobsResult.count;

    if ((recentJobCount ?? 0) >= MAX_QUEUE_JOBS_PER_MINUTE) {
      return respond(
        { error: "Cok fazla medya istegi gonderildi. Lutfen biraz bekleyip tekrar deneyin." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { data: assetExists, error: assetCheckError } = await timeDb(() =>
      existsById(supabase, {
        userId: user.id,
        assetId,
      }),
    );

    if (assetCheckError) {
      return respond({ error: assetCheckError.message }, { status: 400 });
    }

    if (!assetExists) {
      return respond({ error: "Secilen varliga erisim izniniz yok." }, { status: 403 });
    }

    const { data: serviceLog, error: serviceLogError } = await timeDb(() =>
      supabase
        .from("service_logs")
        .select("id,asset_id,user_id")
        .eq("id", serviceLogId)
        .eq("user_id", user.id)
        .maybeSingle(),
    );

    if (serviceLogError || !serviceLog) {
      return respond({ error: "Servis kaydi bulunamadi." }, { status: 404 });
    }

    const relationAssetId = typeof serviceLog.asset_id === "string" ? serviceLog.asset_id.toLowerCase() : "";
    if (serviceLog.user_id !== user.id || !relationAssetId || relationAssetId !== assetId) {
      return respond({ error: "Bu servis kaydina erisim izniniz yok." }, { status: 403 });
    }

    const photoFile = getFileEntry(formData, "photo");
    const videoFile = getFileEntry(formData, "video");
    const audioFile = getFileEntry(formData, "audio");

    const mediaEntries: Array<{ kind: MediaKind; file: File; mimeType: string; extension: string }> = [];
    if (photoFile) {
      const validation = validateMediaFile(photoFile, "photo");
      if ("error" in validation) {
        return respond({ error: validation.error }, { status: 400 });
      }
      mediaEntries.push({ kind: "photo", file: photoFile, ...validation });
    }
    if (videoFile) {
      const validation = validateMediaFile(videoFile, "video");
      if ("error" in validation) {
        return respond({ error: validation.error }, { status: 400 });
      }
      mediaEntries.push({ kind: "video", file: videoFile, ...validation });
    }
    if (audioFile) {
      const validation = validateMediaFile(audioFile, "audio");
      if ("error" in validation) {
        return respond({ error: validation.error }, { status: 400 });
      }
      mediaEntries.push({ kind: "audio", file: audioFile, ...validation });
    }

    if (mediaEntries.length === 0) {
      return respond({ ok: true, uploadedCount: 0, warnings: ["Yuklenecek medya bulunamadi."] }, { status: 200 });
    }

    await timeDb(() =>
      enforceLimit({
        client: supabase,
        userId: user.id,
        profilePlan: auth.profilePlan,
        resource: "documents",
        delta: mediaEntries.length,
      }),
    );

    const attempts = await timeDb(() =>
      mapWithConcurrency(mediaEntries, UPLOAD_CONCURRENCY, async (entry) =>
        uploadSingleMedia({
          supabase,
          userId: user.id,
          assetId,
          serviceLogId,
          entry,
        }),
      ),
    );

    const failedAttempts = attempts.filter((item): item is Extract<UploadAttempt, { ok: false }> => !item.ok);
    const successfulAttempts = attempts.filter((item): item is Extract<UploadAttempt, { ok: true }> => item.ok);

    if (failedAttempts.length > 0) {
      await timeDb(() =>
        rollbackUploadBatch({
          supabase,
          userId: user.id,
          insertedDocumentPaths: successfulAttempts.map((item) => item.storagePath),
          orphanedStoragePaths: failedAttempts
            .map((item) => item.orphanedStoragePath)
            .filter((value): value is string => Boolean(value)),
        }),
      );
      return respond({ error: failedAttempts[0]?.error ?? "Medya yukleme basarisiz." }, { status: 500 });
    }

    const uploads = successfulAttempts.map((item) => item.upload);
    const sortedDocumentIds = successfulAttempts.map((item) => item.documentId).sort();
    const idempotencyKey = buildMediaEnrichmentIdempotencyKey({
      userId: user.id,
      serviceLogId,
      documentIds: sortedDocumentIds,
      nowMs: Date.now(),
    });

    let queuedJob: QueueRow | null = null;
    try {
      queuedJob = (await timeDb(() =>
        queueMediaEnrichmentJob(supabase, {
          user_id: user.id,
          service_log_id: serviceLogId,
          document_ids: sortedDocumentIds,
          idempotency_key: idempotencyKey,
        }),
      )) as QueueRow | null;
    } catch {
      queuedJob = null;
    }

    return finalize(
      buildQueuedServiceMediaResponse({
        uploadedCount: uploads.length,
        queuedJob,
        uploads,
      }),
    );
  } catch (error) {
    if (isPlanLimitError(error)) {
      return respond(toPlanLimitErrorBody(error), { status: 403 });
    }

    logApiError({
      route: "/api/service-media",
      method: "POST",
      requestId,
      userId,
      error,
      status: 500,
      durationMs: Date.now() - startedAt,
      dbTimeMs,
      openAiTimeMs: null,
      message: "Service media request failed unexpectedly",
    });
    return respond({ error: "Medya istegi islenemedi." }, { status: 500 });
  } finally {
    logApiRequest({
      route: "/api/service-media",
      method: "POST",
      requestId,
      userId,
      status: responseStatus,
      durationMs: Date.now() - startedAt,
      dbTimeMs,
      openAiTimeMs: null,
    });
  }
}
