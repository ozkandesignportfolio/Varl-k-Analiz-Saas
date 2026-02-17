import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const OPENAI_TEXT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";

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

const documentTypeByKind: Record<MediaKind, string> = {
  photo: "service_photo",
  video: "service_video",
  audio: "service_audio_note",
};

function sanitizeFileName(fileName: string) {
  const normalized = fileName.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return normalized.slice(-120) || "media.bin";
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
  return parts[parts.length - 1]?.toLowerCase() ?? null;
}

function buildStoragePath(params: {
  userId: string;
  assetId: string;
  serviceLogId: string;
  fileName: string;
  kind: MediaKind;
}) {
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  const safeName = sanitizeFileName(params.fileName);
  const uniqueSuffix = randomUUID().slice(0, 8);
  return `${params.userId}/${params.assetId}/service-logs/${params.serviceLogId}/${params.kind}-${timestamp}-${uniqueSuffix}-${safeName}`;
}

function buildMetadata(file: File) {
  return {
    mime_type: file.type || null,
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

  const metadata = buildMetadata(videoFile);
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
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Dosya boyutu limit asiyor (${kind}).`;
  }

  const accepted = allowedMimeTypes[kind];
  if (!accepted.includes(file.type)) {
    return `Desteklenmeyen dosya tipi (${kind}): ${file.type || "unknown"}.`;
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
  }

  const assetId = String(formData.get("assetId") ?? "").trim();
  const serviceLogId = String(formData.get("serviceLogId") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "").trim();
  const serviceDate = String(formData.get("serviceDate") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim() || null;
  const userNotes = String(formData.get("notes") ?? "").trim() || null;

  if (!assetId || !serviceLogId || !serviceType || !serviceDate) {
    return NextResponse.json({ error: "Zorunlu alanlar eksik." }, { status: 400 });
  }

  const { data: serviceLog, error: serviceLogError } = await supabase
    .from("service_logs")
    .select("id,asset_id,user_id,notes")
    .eq("id", serviceLogId)
    .eq("user_id", user.id)
    .single();

  if (serviceLogError || !serviceLog) {
    return NextResponse.json({ error: "Servis kaydı bulunamadı." }, { status: 404 });
  }

  if (serviceLog.user_id !== user.id || serviceLog.asset_id !== assetId) {
    return NextResponse.json({ error: "Bu servis kaydına erişim izniniz yok." }, { status: 403 });
  }

  const photoFile = getFileEntry(formData, "photo");
  const videoFile = getFileEntry(formData, "video");
  const audioFile = getFileEntry(formData, "audio");

  const mediaEntries: Array<{ kind: MediaKind; file: File }> = [];
  if (photoFile) mediaEntries.push({ kind: "photo", file: photoFile });
  if (videoFile) mediaEntries.push({ kind: "video", file: videoFile });
  if (audioFile) mediaEntries.push({ kind: "audio", file: audioFile });

  if (mediaEntries.length === 0) {
    return NextResponse.json({ ok: true, uploadedCount: 0, warnings: ["Yüklenecek medya bulunamadı."] });
  }

  for (const entry of mediaEntries) {
    const fileError = validateMediaFile(entry.file, entry.kind);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }
  }

  const uploads: MediaUploadResult[] = [];
  for (const entry of mediaEntries) {
    const storagePath = buildStoragePath({
      userId: user.id,
      assetId,
      serviceLogId,
      fileName: entry.file.name,
      kind: entry.kind,
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, entry.file, { contentType: entry.file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `${entry.kind} dosyası yüklenemedi.` }, { status: 500 });
    }

    const { error: docError } = await supabase.from("documents").insert({
      asset_id: assetId,
      user_id: user.id,
      service_log_id: serviceLogId,
      document_type: documentTypeByKind[entry.kind],
      file_name: entry.file.name,
      storage_path: storagePath,
      file_size: entry.file.size,
    });

    if (docError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: `${entry.kind} doküman kaydı oluşturulamadı.` }, { status: 500 });
    }

    uploads.push({
      kind: entry.kind,
      fileName: entry.file.name,
      mimeType: entry.file.type,
      size: entry.file.size,
      storagePath,
      metadata: buildMetadata(entry.file),
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
    warnings.push("Fotograf metadata analizi tamamlanamadı.");
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

  const existingNotes = userNotes ?? serviceLog.notes ?? null;
  const updatedNotes = composeUpdatedNotes({
    existingNotes,
    suggestedDescription,
    transcription,
    uploads,
  });

  if (updatedNotes && updatedNotes !== (serviceLog.notes ?? "").trim()) {
    const { error: updateError } = await supabase
      .from("service_logs")
      .update({ notes: updatedNotes })
      .eq("id", serviceLogId)
      .eq("user_id", user.id);

    if (updateError) {
      warnings.push("AI notları servis kaydına yazılamadı.");
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
}


