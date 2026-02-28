import { createHash, randomUUID } from "crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { existsById } from "@/lib/repos/assets-repo";
import { countByUser as countDocumentsByUser } from "@/lib/repos/documents-repo";
import { canUploadDocument } from "@/lib/plans/plan-config";
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import { requireRouteUser, type RouteAuthSuccess } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SERVICE_TYPE_LENGTH = 120;
const MAX_PROVIDER_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MAX_QUEUE_JOBS_PER_MINUTE = 20;

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
  status: string;
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

function normalizeUuid(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function parseDateOnly(value: string) {
  const trimmed = value.trim();
  if (!DATE_PATTERN.test(trimmed)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = trimmed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

function readFormText(
  formData: FormData,
  key: string,
  options: { required?: boolean; maxLength?: number } = {},
) {
  const entry = formData.get(key);
  if (entry === null) {
    return options.required ? { value: "", missing: true } : { value: "" };
  }

  if (typeof entry !== "string") {
    return { value: "", invalidType: true };
  }

  const trimmed = entry.trim();
  if (options.required && !trimmed) {
    return { value: "", missing: true };
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    return { value: "", tooLong: true };
  }

  return { value: trimmed };
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
  if (file.size <= 0) {
    return { error: `Bos dosya yuklenemez (${kind}).` };
  }

  const mimeType = file.type.trim().toLowerCase();
  const acceptedMimeTypes = allowedMimeTypes[kind];
  if (!mimeType || !acceptedMimeTypes.includes(mimeType)) {
    return { error: `Desteklenmeyen dosya tipi (${kind}): ${mimeType || "unknown"}.` };
  }

  const extension = getExtension(file.name);
  const acceptedExtensions = allowedExtensions[kind];
  if (!extension || !acceptedExtensions.includes(extension)) {
    return {
      error: `Dosya uzantisi desteklenmiyor (${kind}): ${extension || "unknown"}.`,
    };
  }

  const compatibleExtensions = compatibleExtensionsByMimeType[mimeType];
  if (compatibleExtensions && !compatibleExtensions.includes(extension)) {
    return {
      error: `Dosya uzantisi ve MIME tipi uyusmuyor (${kind}): ${mimeType} / .${extension}.`,
    };
  }

  return {
    mimeType,
    extension,
  };
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

function normalizeIdempotencyKey(raw: string | null) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
}

function buildDefaultIdempotencyKey(params: {
  userId: string;
  assetId: string;
  serviceLogId: string;
  serviceDate: string;
  serviceType: string;
  uploads: MediaUploadResult[];
}) {
  const base = [
    params.userId,
    params.assetId,
    params.serviceLogId,
    params.serviceDate,
    params.serviceType,
    ...params.uploads
      .map((item) => `${item.kind}:${item.fileName}:${item.size}:${item.mimeType}`)
      .sort((left, right) => left.localeCompare(right)),
  ].join("|");

  return createHash("sha256").update(base).digest("hex");
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

const isUniqueViolation = (error: { code?: string | null } | null | undefined) => error?.code === "23505";

export async function POST(request: Request) {
  let userId: string | null = null;

  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const { supabase, user } = auth;
    userId = user.id;

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Gecersiz form verisi." }, { status: 400 });
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
      return NextResponse.json({ error: "Varlik veya servis kaydi kimligi gecersiz." }, { status: 400 });
    }

    if (
      serviceTypeField.invalidType ||
      serviceDateField.invalidType ||
      providerField.invalidType ||
      userNotesField.invalidType
    ) {
      return NextResponse.json({ error: "Metin alanlari gecersiz." }, { status: 400 });
    }

    if (serviceTypeField.tooLong) {
      return NextResponse.json({ error: "Servis turu cok uzun." }, { status: 400 });
    }

    if (providerField.tooLong) {
      return NextResponse.json({ error: "Saglayici bilgisi cok uzun." }, { status: 400 });
    }

    if (userNotesField.tooLong) {
      return NextResponse.json({ error: "Not alani cok uzun." }, { status: 400 });
    }

    const assetId = normalizeUuid(assetIdField.value);
    const serviceLogId = normalizeUuid(serviceLogIdField.value);
    const serviceType = serviceTypeField.value;
    const serviceDate = serviceDateField.value;
    const provider = providerField.value || null;
    const userNotes = userNotesField.value || null;

    if (!assetId || !serviceLogId) {
      return NextResponse.json({ error: "Varlik veya servis kaydi kimligi gecersiz." }, { status: 400 });
    }

    if (!serviceType || !serviceDate) {
      return NextResponse.json({ error: "Zorunlu alanlar eksik." }, { status: 400 });
    }

    if (!parseDateOnly(serviceDate)) {
      return NextResponse.json({ error: "Servis tarihi gecersiz." }, { status: 400 });
    }

    const rawIdempotencyKey = normalizeIdempotencyKey(request.headers.get("x-idempotency-key"));
    if (rawIdempotencyKey) {
      const { data: existingJob } = await supabase
        .from("media_enrichment_jobs")
        .select("id,status")
        .eq("user_id", user.id)
        .eq("service_log_id", serviceLogId)
        .eq("idempotency_key", rawIdempotencyKey)
        .maybeSingle();

      if (existingJob) {
        const reusedJob = existingJob as QueueRow;
        return NextResponse.json(
          {
            ok: true,
            uploadedCount: 0,
            enrichment: reusedJob.status,
            idempotencyReused: true,
            jobId: reusedJob.id,
            warnings: [],
          },
          { status: 202 },
        );
      }
    }

    const oneMinuteAgoIso = new Date(Date.now() - 60_000).toISOString();
    const { count: recentJobCount } = await supabase
      .from("media_enrichment_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneMinuteAgoIso);

    if ((recentJobCount ?? 0) >= MAX_QUEUE_JOBS_PER_MINUTE) {
      return NextResponse.json(
        { error: "Cok fazla medya istegi gonderildi. Lutfen biraz bekleyip tekrar deneyin." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { data: assetExists, error: assetCheckError } = await existsById(supabase, {
      userId: user.id,
      assetId,
    });

    if (assetCheckError) {
      return NextResponse.json({ error: assetCheckError.message }, { status: 400 });
    }

    if (!assetExists) {
      return NextResponse.json({ error: "Secilen varliga erisim izniniz yok." }, { status: 403 });
    }

    const { data: serviceLog, error: serviceLogError } = await supabase
      .from("service_logs")
      .select("id,asset_id,user_id,notes")
      .eq("id", serviceLogId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (serviceLogError || !serviceLog) {
      return NextResponse.json({ error: "Servis kaydi bulunamadi." }, { status: 404 });
    }

    const relationAssetId = typeof serviceLog.asset_id === "string" ? serviceLog.asset_id.toLowerCase() : "";
    if (serviceLog.user_id !== user.id || !relationAssetId || relationAssetId !== assetId) {
      return NextResponse.json({ error: "Bu servis kaydina erisim izniniz yok." }, { status: 403 });
    }

    const photoFile = getFileEntry(formData, "photo");
    const videoFile = getFileEntry(formData, "video");
    const audioFile = getFileEntry(formData, "audio");

    const mediaEntries: Array<{ kind: MediaKind; file: File; mimeType: string; extension: string }> = [];
    if (photoFile) {
      const validation = validateMediaFile(photoFile, "photo");
      if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      mediaEntries.push({ kind: "photo", file: photoFile, ...validation });
    }
    if (videoFile) {
      const validation = validateMediaFile(videoFile, "video");
      if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      mediaEntries.push({ kind: "video", file: videoFile, ...validation });
    }
    if (audioFile) {
      const validation = validateMediaFile(audioFile, "audio");
      if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      mediaEntries.push({ kind: "audio", file: audioFile, ...validation });
    }

    if (mediaEntries.length === 0) {
      return NextResponse.json({ ok: true, uploadedCount: 0, warnings: ["Yuklenecek medya bulunamadi."] });
    }

    if (auth.profilePlan !== "premium") {
      const userPlan = getPlanConfigFromProfilePlan(auth.profilePlan);
      const { data: currentDocumentCount, error: documentCountError } = await countDocumentsByUser(supabase, {
        userId: user.id,
      });

      if (documentCountError) {
        return NextResponse.json({ error: documentCountError.message }, { status: 400 });
      }

      const documentLimitCheck = canUploadDocument({
        planConfig: userPlan,
        currentCount: currentDocumentCount ?? 0,
        requestedCount: mediaEntries.length,
      });

      if (!documentLimitCheck.allowed) {
        return NextResponse.json(
          { error: documentLimitCheck.errorMessage ?? "Plan limitine ulastiniz." },
          { status: 403 },
        );
      }
    }

    const attempts: UploadAttempt[] = [];
    for (const entry of mediaEntries) {
      attempts.push(
        await uploadSingleMedia({
          supabase,
          userId: user.id,
          assetId,
          serviceLogId,
          entry,
        }),
      );
    }

    const failedAttempts = attempts.filter((item): item is Extract<UploadAttempt, { ok: false }> => !item.ok);
    const successfulAttempts = attempts.filter((item): item is Extract<UploadAttempt, { ok: true }> => item.ok);

    if (failedAttempts.length > 0) {
      await rollbackUploadBatch({
        supabase,
        userId: user.id,
        insertedDocumentPaths: successfulAttempts.map((item) => item.storagePath),
        orphanedStoragePaths: failedAttempts
          .map((item) => item.orphanedStoragePath)
          .filter((value): value is string => Boolean(value)),
      });
      return NextResponse.json({ error: failedAttempts[0]?.error ?? "Medya yukleme basarisiz." }, { status: 500 });
    }

    const uploads = successfulAttempts.map((item) => item.upload);
    const warnings: string[] = [];

    const queuePayload = {
      serviceType,
      serviceDate,
      provider,
      userNotes,
      existingNotes: typeof serviceLog.notes === "string" ? serviceLog.notes : null,
      uploads,
    };

    const idempotencyKey =
      rawIdempotencyKey ??
      buildDefaultIdempotencyKey({
        userId: user.id,
        assetId,
        serviceLogId,
        serviceDate,
        serviceType,
        uploads,
      });

    let queuedJob: QueueRow | null = null;

    const queueInsert = await supabase
      .from("media_enrichment_jobs")
      .insert({
        user_id: user.id,
        asset_id: assetId,
        service_log_id: serviceLogId,
        idempotency_key: idempotencyKey,
        status: "queued",
        payload: queuePayload,
      })
      .select("id,status")
      .single();

    if (queueInsert.error) {
      if (isUniqueViolation(queueInsert.error)) {
        const existingJobRes = await supabase
          .from("media_enrichment_jobs")
          .select("id,status")
          .eq("idempotency_key", idempotencyKey)
          .eq("user_id", user.id)
          .eq("service_log_id", serviceLogId)
          .maybeSingle();
        queuedJob = (existingJobRes.data as QueueRow | null) ?? null;
        warnings.push("Ayni idempotency key ile daha once kuyruklanan bir is bulundu.");
      } else {
        warnings.push("AI enrichment kuyruga alinamadi.");
      }
    } else {
      queuedJob = (queueInsert.data as QueueRow | null) ?? null;
    }

    return NextResponse.json(
      {
        ok: true,
        uploadedCount: uploads.length,
        enrichment: queuedJob?.status ?? "not_queued",
        jobId: queuedJob?.id ?? null,
        media: uploads.map((item) => ({
          kind: item.kind,
          fileName: item.fileName,
          mimeType: item.mimeType,
          size: item.size,
          storagePath: item.storagePath,
          metadata: item.metadata,
        })),
        warnings,
      },
      { status: 202 },
    );
  } catch (error) {
    logApiError({
      route: "/api/service-media",
      method: "POST",
      userId,
      error,
      message: "Service media request failed unexpectedly",
    });
    return NextResponse.json({ error: "Medya istegi islenemedi." }, { status: 500 });
  }
}
