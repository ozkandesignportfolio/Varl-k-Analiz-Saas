import "server-only";

import { Buffer } from "node:buffer";
import { fetchWithRetry } from "@/lib/net/fetch-with-timeout";
import { ServerEnv } from "@/lib/env/server-env";

const OPENAI_TEXT_MODEL = ServerEnv.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_TRANSCRIBE_MODEL = ServerEnv.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

const OPENAI_RETRIES = 1;
const OPENAI_TIMEOUT_MS = 12_000;

export type ServiceMediaKind = "photo" | "video" | "audio";

export type ServiceMediaUploadPayload = {
  kind: ServiceMediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  metadata: Record<string, string | number | boolean | null>;
};

type EnrichServiceMediaNotesParams = {
  apiKey: string | undefined;
  serviceType: string;
  serviceDate: string;
  provider: string | null;
  userNotes: string | null;
  existingNotes: string | null;
  uploads: ServiceMediaUploadPayload[];
  downloadFile: (storagePath: string) => Promise<Blob | null>;
};

export type EnrichServiceMediaNotesResult = {
  transcription: string | null;
  suggestedDescription: string | null;
  updatedNotes: string | null;
  warnings: string[];
  uploadsWithAiMetadata: Array<ServiceMediaUploadPayload & { aiMetadata: Record<string, unknown> | null }>;
};

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
  const response = await fetchWithRetry(
    "https://api.openai.com/v1/responses",
    {
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
    },
    {
      timeoutMs: OPENAI_TIMEOUT_MS,
      retries: OPENAI_RETRIES,
      baseDelayMs: 300,
      maxDelayMs: 1_200,
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return extractOpenAiOutputText(payload);
}

async function transcribeAudio(params: { audioBlob: Blob; fileName: string; apiKey: string | undefined }) {
  if (!params.apiKey) {
    return null;
  }

  const formData = new FormData();
  formData.append("model", OPENAI_TRANSCRIBE_MODEL);
  formData.append("language", "tr");
  formData.append("file", params.audioBlob, params.fileName);

  const response = await fetchWithRetry(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: formData,
    },
    {
      timeoutMs: OPENAI_TIMEOUT_MS,
      retries: OPENAI_RETRIES,
      baseDelayMs: 300,
      maxDelayMs: 1_200,
    },
  );

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

async function parsePhotoMetadata(params: {
  photoBlob: Blob;
  mimeType: string;
  apiKey: string | undefined;
}) {
  if (!params.apiKey) {
    return null;
  }

  const base64 = Buffer.from(await params.photoBlob.arrayBuffer()).toString("base64");
  const imageUrl = `data:${params.mimeType || "image/jpeg"};base64,${base64}`;
  const aiText = await callOpenAiResponsesApi({
    apiKey: params.apiKey,
    maxOutputTokens: 500,
    input: [
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
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
  });

  return parseJsonObject(aiText);
}

async function parseVideoMetadata(videoUpload: ServiceMediaUploadPayload, apiKey: string | undefined) {
  if (!apiKey) {
    return null;
  }

  const aiText = await callOpenAiResponsesApi({
    apiKey,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Asagidaki video dosya metadata bilgisini servis baglaminda parse et.",
              "Sadece JSON don.",
              'Beklenen alanlar: {"container":"string|null","capture_type":"string|null","service_tags":"string[]","manual_review_needed":boolean}',
              `Dosya metadata: ${JSON.stringify(videoUpload.metadata)}`,
              `Dosya adi: ${videoUpload.fileName}`,
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
      `${params.serviceDate} tarihinde ${params.serviceType} islemi kaydedildi.`,
      params.provider ? `Saglayici: ${params.provider}.` : null,
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
              "Bakim/servis gunlugu icin 1-2 cumlelik kisa, net bir otomatik aciklama onerisi yaz.",
              "Yanit Turkce ve sade olsun. Sadece aciklama metni don.",
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
  uploads: Array<ServiceMediaUploadPayload & { aiMetadata: Record<string, unknown> | null }>;
}) {
  const sections: string[] = [];
  const baseNotes = params.existingNotes?.trim();

  if (baseNotes) {
    sections.push(baseNotes);
  }

  if (params.suggestedDescription) {
    sections.push(`AI Aciklama Onerisi:\n${params.suggestedDescription}`);
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

export async function enrichServiceMediaNotes(
  params: EnrichServiceMediaNotesParams,
): Promise<EnrichServiceMediaNotesResult> {
  const warnings: string[] = [];
  const uploadsWithAiMetadata = params.uploads.map((upload) => ({
    ...upload,
    aiMetadata: null as Record<string, unknown> | null,
  }));

  if (!params.apiKey) {
    warnings.push("OPENAI_API_KEY tanimli olmadigi icin AI fallback metni kullanildi.");
  }

  const audioUpload = params.uploads.find((upload) => upload.kind === "audio") ?? null;
  const photoUpload = params.uploads.find((upload) => upload.kind === "photo") ?? null;
  const videoUpload = params.uploads.find((upload) => upload.kind === "video") ?? null;

  let transcription: string | null = null;
  if (audioUpload) {
    const audioBlob = await params.downloadFile(audioUpload.storagePath);
    if (!audioBlob) {
      warnings.push("Ses dosyasi indirilemedi.");
    } else {
      transcription = await transcribeAudio({
        audioBlob,
        fileName: audioUpload.fileName,
        apiKey: params.apiKey,
      });
      if (!transcription) {
        warnings.push("Ses dosyasi transkribe edilemedi.");
      }
    }
  }

  let photoMetadata: Record<string, unknown> | null = null;
  if (photoUpload) {
    const photoBlob = await params.downloadFile(photoUpload.storagePath);
    if (!photoBlob) {
      warnings.push("Fotograf dosyasi indirilemedi.");
    } else {
      photoMetadata = await parsePhotoMetadata({
        photoBlob,
        mimeType: photoUpload.mimeType,
        apiKey: params.apiKey,
      });
      if (!photoMetadata) {
        warnings.push("Fotograf metadata analizi tamamlanamadi.");
      }
    }
  }

  const videoMetadata = videoUpload ? await parseVideoMetadata(videoUpload, params.apiKey) : null;
  if (videoUpload && !videoMetadata) {
    warnings.push("Video metadata analizi tamamlanamadi.");
  }

  for (const upload of uploadsWithAiMetadata) {
    if (upload.kind === "photo") {
      upload.aiMetadata = photoMetadata;
    }
    if (upload.kind === "video") {
      upload.aiMetadata = videoMetadata;
    }
  }

  const suggestedDescription = await suggestDescription({
    apiKey: params.apiKey,
    serviceType: params.serviceType,
    serviceDate: params.serviceDate,
    provider: params.provider,
    userNotes: params.userNotes,
    transcription,
    photoMetadata,
    videoMetadata,
  });

  const updatedNotes = composeUpdatedNotes({
    existingNotes: params.existingNotes,
    suggestedDescription,
    transcription,
    uploads: uploadsWithAiMetadata,
  });

  return {
    transcription,
    suggestedDescription,
    updatedNotes,
    warnings,
    uploadsWithAiMetadata,
  };
}
