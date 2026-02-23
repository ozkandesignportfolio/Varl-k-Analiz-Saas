import { randomUUID } from "crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { existsById } from "@/lib/repos/assets-repo";
import { countByUser as countDocumentsByUser } from "@/lib/repos/documents-repo";
import { canUploadDocument, getUserPlanConfig } from "@/lib/plans/plan-config";
import { requireRouteUser, type RouteAuthSuccess } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const OPENAI_TEXT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SERVICE_TYPE_LENGTH = 120;
const MAX_PROVIDER_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;

type MediaKind = "photo" | "video" | "audio";

type MediaUploadResult = {
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  metadata: Record<string, string | number | boolean | null>;
  aiMetadata: Record<string, unknown> | null;
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

function summarizeMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return "-";
  }

  const raw = JSON.stringify(metadata);
  if (raw.length <= 300) {
    return raw;
  }
  return `${raw.slice(0, 297)}...`;
}

function normalizeResponseText(raw: string | null) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z0-9]*\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();
}

function parseJsonObject(raw: string | null) {
  const normalized = normalizeResponseText(raw);
  if (!normalized) {
    return null;
  }

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

function extractOpenAiOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const directOutputText = (payload as { output_text?: unknown }).output_text;
  if (typeof directOutputText === "string" && directOutputText.trim()) {
    return directOutputText.trim();
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  const chunks: string[] = [];
  for (const entry of output) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const content = (entry as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const item of content) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const maybeText = (item as { text?: unknown }).text;
      if (typeof maybeText === "string" && maybeText.trim()) {
        chunks.push(maybeText.trim());
      }
    }
  }

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join("\n").trim();
}

async function callOpenAiResponsesApi(params: {
  apiKey: string;
  input: Array<{ role: "user"; content: Array<{ type: string; text?: string; image_url?: string }> }>;
  maxOutputTokens?: number;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      temperature: 0.2,
      max_output_tokens: params.maxOutputTokens ?? 500,
      input: params.input,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return extractOpenAiOutputText(payload);
}

async function transcribeAudio(audioFile: File, apiKey: string | undefined) {
  if (!apiKey) {
    return null;
  }

  const formData = new FormData();
  formData.append("model", OPENAI_TRANSCRIBE_MODEL);
  formData.append("language", "tr");
  formData.append("file", audioFile, audioFile.name);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { text?: unknown } | null;
  const text = payload?.text;
  if (typeof text !== "string") {
    return null;
  }

  return text.trim() || null;
}

async function parsePhotoMetadata(photoFile: File, apiKey: string | undefined) {
  if (!apiKey) {
    return null;
  }

  const base64 = Buffer.from(await photoFile.arrayBuffer()).toString("base64");
  const imageUrl = `data:${photoFile.type || "image/jpeg"};base64,${base64}`;
  const aiText = await callOpenAiResponsesApi({
    apiKey,
    maxOutputTokens: 500,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Aşağıdaki servis fotoğrafını teknik metadata + servis bağlamı olarak JSON formatında özetle.",
              "Sadece JSON dön.",
              'Beklenen alanlar: {"scene":"string","detected_items":"string[]","condition_signals":"string[]","possible_issue":"string|null","confidence":"low|medium|high"}',
            ].join("\n"),
          },
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
  });

  return parseJsonObject(aiText);
}

async function parseVideoMetadata(videoFile: File, apiKey: string | undefined) {
  if (!apiKey) {
    return null;
  }

  const metadata = buildMetadata(videoFile, videoFile.type || "application/octet-stream");
  const aiText = await callOpenAiResponsesApi({
    apiKey,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Aşağıdaki video dosya metadata bilgisini servis bağlamında parse et.",
              "Sadece JSON dön.",
              'Beklenen alanlar: {"container":"string|null","capture_type":"string|null","service_tags":"string[]","manual_review_needed":boolean}',
              `Dosya metadata: ${JSON.stringify(metadata)}`,
              `Dosya adı: ${videoFile.name}`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  return parseJsonObject(aiText);
}

async function suggestDescription(params: {
  apiKey: string | undefined;
  serviceType: string;
  serviceDate: string;
  provider: string | null;
  userNotes: string | null;
  transcription: string | null;
  photoMetadata: Record<string, unknown> | null;
  videoMetadata: Record<string, unknown> | null;
}) {
  if (!params.apiKey) {
    const parts = [
      `${params.serviceDate} tarihinde ${params.serviceType} işlemi kaydedildi.`,
      params.provider ? `Sağlayıcı: ${params.provider}.` : null,
      params.userNotes ? `Not: ${params.userNotes}.` : null,
    ].filter(Boolean);
    return parts.join(" ");
  }

  const aiText = await callOpenAiResponsesApi({
    apiKey: params.apiKey,
    maxOutputTokens: 220,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Bakım/servis günlüğü için 1-2 cümlelik kısa, net bir otomatik açıklama önerisi yaz.",
              "Yanıt Türkçe ve sade olsun. Sadece açıklama metni dön.",
              `service_type: ${params.serviceType}`,
              `service_date: ${params.serviceDate}`,
              `provider: ${params.provider ?? "-"}`,
              `user_notes: ${params.userNotes ?? "-"}`,
              `audio_transcription: ${params.transcription ?? "-"}`,
              `photo_metadata: ${JSON.stringify(params.photoMetadata)}`,
              `video_metadata: ${JSON.stringify(params.videoMetadata)}`,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  if (!aiText) {
    return null;
  }

  return aiText.trim() || null;
}

function composeUpdatedNotes(params: {
  existingNotes: string | null;
  suggestedDescription: string | null;
  transcription: string | null;
  uploads: MediaUploadResult[];
}) {
  const sections: string[] = [];
  const baseNotes = params.existingNotes?.trim();

  if (baseNotes) {
    sections.push(baseNotes);
  }

  if (params.suggestedDescription) {
    sections.push(`AI Açıklama Onerisi:\n${params.suggestedDescription}`);
  }

  if (params.transcription) {
    sections.push(`Ses Transkripsiyonu:\n${params.transcription}`);
  }

  const visualSummaries = params.uploads
    .filter((item) => item.kind === "photo" || item.kind === "video")
    .map((item) => {
      const parsed = item.aiMetadata ?? item.metadata;
      return `${item.kind}: ${summarizeMetadata(parsed)}`;
    });

  if (visualSummaries.length > 0) {
    sections.push(`Medya Metadata:\n${visualSummaries.join("\n")}`);
  }

  const merged = sections.join("\n\n").trim();
  return merged || null;
}

function validateMediaFile(file: File, kind: MediaKind) {
  if (file.size <= 0) {
    return { error: `Boş dosya yüklenemez (${kind}).` };
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
      return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
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
      return NextResponse.json({ error: "Varlık veya servis kaydı kimliği geçersiz." }, { status: 400 });
    }

    if (
      serviceTypeField.invalidType ||
      serviceDateField.invalidType ||
      providerField.invalidType ||
      userNotesField.invalidType
    ) {
      return NextResponse.json({ error: "Metin alanları geçersiz." }, { status: 400 });
    }

    if (serviceTypeField.tooLong) {
      return NextResponse.json({ error: "Servis türü çok uzun." }, { status: 400 });
    }

    if (providerField.tooLong) {
      return NextResponse.json({ error: "Sağlayıcı bilgisi çok uzun." }, { status: 400 });
    }

    if (userNotesField.tooLong) {
      return NextResponse.json({ error: "Not alanı çok uzun." }, { status: 400 });
    }

    const assetId = normalizeUuid(assetIdField.value);
    const serviceLogId = normalizeUuid(serviceLogIdField.value);
    const serviceType = serviceTypeField.value;
    const serviceDate = serviceDateField.value;
    const provider = providerField.value || null;
    const userNotes = userNotesField.value || null;

    if (!assetId || !serviceLogId) {
      return NextResponse.json({ error: "Varlık veya servis kaydı kimliği geçersiz." }, { status: 400 });
    }

    if (!serviceType || !serviceDate) {
      return NextResponse.json({ error: "Zorunlu alanlar eksik." }, { status: 400 });
    }

    if (!parseDateOnly(serviceDate)) {
      return NextResponse.json({ error: "Servis tarihi geçersiz." }, { status: 400 });
    }

    const { data: assetExists, error: assetCheckError } = await existsById(supabase, {
      userId: user.id,
      assetId,
    });

    if (assetCheckError) {
      return NextResponse.json({ error: assetCheckError.message }, { status: 400 });
    }

    if (!assetExists) {
      return NextResponse.json({ error: "Seçilen varlığa erişim izniniz yok." }, { status: 403 });
    }

    const { data: serviceLog, error: serviceLogError } = await supabase
      .from("service_logs")
      .select("id,asset_id,user_id,notes")
      .eq("id", serviceLogId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (serviceLogError || !serviceLog) {
      return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });
    }

    const relationAssetId = typeof serviceLog.asset_id === "string" ? serviceLog.asset_id.toLowerCase() : "";
    if (serviceLog.user_id !== user.id || !relationAssetId || relationAssetId !== assetId) {
      return NextResponse.json({ error: "Bu servis kaydına erişim izniniz yok." }, { status: 403 });
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
      return NextResponse.json({ ok: true, uploadedCount: 0, warnings: ["Yüklenecek medya bulunamadı."] });
    }

    const userPlan = getUserPlanConfig(user);
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
        { error: documentLimitCheck.errorMessage ?? "Plan limitine ulaştınız." },
        { status: 403 },
      );
    }

    const uploads: MediaUploadResult[] = [];
    const insertedDocumentPaths: string[] = [];
    for (const entry of mediaEntries) {
      const storagePath = buildStoragePath({
        userId: user.id,
        assetId,
        serviceLogId,
        fileName: entry.file.name,
        extension: entry.extension,
        kind: entry.kind,
      });

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, entry.file, { contentType: entry.mimeType, upsert: false });

      if (uploadError) {
        await rollbackUploadBatch({
          supabase,
          userId: user.id,
          insertedDocumentPaths,
          orphanedStoragePaths: [],
        });
        return NextResponse.json({ error: `${entry.kind} dosyası yüklenemedi.` }, { status: 500 });
      }

      const { data: insertedDocument, error: docError } = await supabase
        .from("documents")
        .insert({
          asset_id: assetId,
          user_id: user.id,
          service_log_id: serviceLogId,
          document_type: documentTypeByKind[entry.kind],
          file_name: normalizeDisplayFileName(entry.file.name),
          storage_path: storagePath,
          file_size: entry.file.size,
        })
        .select("id")
        .single();

      if (docError || !insertedDocument?.id) {
        await rollbackUploadBatch({
          supabase,
          userId: user.id,
          insertedDocumentPaths,
          orphanedStoragePaths: [storagePath],
        });
        return NextResponse.json({ error: `${entry.kind} doküman kaydı oluşturulamadı.` }, { status: 500 });
      }

      insertedDocumentPaths.push(storagePath);
      logAuditEvent({
        route: "/api/service-media",
        userId: user.id,
        entityType: "documents",
        entityId: insertedDocument.id,
        action: "create",
        meta: { documentType: documentTypeByKind[entry.kind], serviceLogId },
      });
      uploads.push({
        kind: entry.kind,
        fileName: entry.file.name,
        mimeType: entry.mimeType,
        size: entry.file.size,
        storagePath,
        metadata: buildMetadata(entry.file, entry.mimeType),
        aiMetadata: null,
      });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
    const warnings: string[] = [];

    const transcription = audioFile ? await transcribeAudio(audioFile, openAiApiKey) : null;
    if (audioFile && !transcription) {
      warnings.push("Ses dosyası transkribe edilemedi.");
    }

    const photoMetadata = photoFile ? await parsePhotoMetadata(photoFile, openAiApiKey) : null;
    if (photoFile && !photoMetadata) {
      warnings.push("Fotoğraf metadata analizi tamamlanamadı.");
    }

    const videoMetadata = videoFile ? await parseVideoMetadata(videoFile, openAiApiKey) : null;
    if (videoFile && !videoMetadata) {
      warnings.push("Video metadata analizi tamamlanamadı.");
    }

    for (const upload of uploads) {
      if (upload.kind === "photo") {
        upload.aiMetadata = photoMetadata;
      }
      if (upload.kind === "video") {
        upload.aiMetadata = videoMetadata;
      }
    }

    if (!openAiApiKey) {
      warnings.push("OPENAI_API_KEY tanımlı olmadığı için AI fallback metni kullanıldı.");
    }

    const suggestedDescription = await suggestDescription({
      apiKey: openAiApiKey,
      serviceType,
      serviceDate,
      provider,
      userNotes,
      transcription,
      photoMetadata,
      videoMetadata,
    });

    const existingNotes = userNotes ?? (typeof serviceLog.notes === "string" ? serviceLog.notes : null);
    const updatedNotes = composeUpdatedNotes({
      existingNotes,
      suggestedDescription,
      transcription,
      uploads,
    });

    if (updatedNotes && updatedNotes !== (typeof serviceLog.notes === "string" ? serviceLog.notes.trim() : "")) {
      const { error: updateError } = await supabase
        .from("service_logs")
        .update({ notes: updatedNotes })
        .eq("id", serviceLogId)
        .eq("user_id", user.id);

      if (updateError) {
        warnings.push("AI notları servis kaydına yazılamadı.");
      } else {
        logAuditEvent({
          route: "/api/service-media",
          userId: user.id,
          entityType: "service_logs",
          entityId: serviceLogId,
          action: "update",
          meta: { fields: ["notes"], source: "ai_media_enrichment" },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      uploadedCount: uploads.length,
      transcription,
      suggestedDescription,
      media: uploads.map((item) => ({
        kind: item.kind,
        fileName: item.fileName,
        mimeType: item.mimeType,
        size: item.size,
        storagePath: item.storagePath,
        metadata: item.aiMetadata ?? item.metadata,
      })),
      warnings,
    });
  } catch (error) {
    logApiError({
      route: "/api/service-media",
      method: "POST",
      userId,
      error,
      message: "Service media request failed unexpectedly",
    });
    return NextResponse.json({ error: "Medya isteği işlenemedi." }, { status: 500 });
  }
}



