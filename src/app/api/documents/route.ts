import { randomUUID } from "crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { existsById } from "@/lib/repos/assets-repo";
import { countByUser as countDocumentsByUser } from "@/lib/repos/documents-repo";
import { canUploadDocument, getUserPlanConfig } from "@/lib/plans/plan-config";
import { requireRouteUser } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_DOCUMENT_TYPES = ["garanti", "fatura", "servis_formu", "diger"] as const;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/webm",
  "audio/ogg",
] as const;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "mp4",
  "mov",
  "qt",
  "webm",
  "mkv",
  "mp3",
  "mpeg",
  "wav",
  "m4a",
  "ogg",
] as const;

const COMPATIBLE_EXTENSIONS_BY_MIME_TYPE: Record<string, string[]> = {
  "application/pdf": ["pdf"],
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

const getFileEntry = (formData: FormData, key: string) => {
  const entry = formData.get(key);
  if (!(entry instanceof File)) {
    return null;
  }
  return entry.size > 0 ? entry : null;
};

const normalizeUuid = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const getExtension = (fileName: string) => {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return null;
  }
  return parts[parts.length - 1]?.toLowerCase().trim() ?? null;
};

const normalizeDisplayFileName = (fileName: string) => {
  const leafName = fileName.split(/[\\/]/).pop() ?? fileName;
  const trimmed = leafName.trim();
  return trimmed.slice(0, 255) || "document";
};

const sanitizeFileStem = (fileName: string) => {
  const leafName = normalizeDisplayFileName(fileName);
  const extensionIndex = leafName.lastIndexOf(".");
  const stem = extensionIndex > 0 ? leafName.slice(0, extensionIndex) : leafName;
  const asciiOnly = stem.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");

  const normalized = asciiOnly
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized.slice(0, 80) || "document";
};

const buildStoragePath = (params: {
  userId: string;
  assetId: string;
  documentType: typeof ALLOWED_DOCUMENT_TYPES[number];
  fileName: string;
  extension: string;
}) => {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const safeStem = sanitizeFileStem(params.fileName);
  const uniqueSuffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const objectName = `${params.documentType}-${timestamp}-${uniqueSuffix}-${safeStem}.${params.extension}`;
  return path.posix.join(params.userId, params.assetId, "documents", objectName);
};

const validateUploadFile = (file: File) => {
  if (file.size <= 0) {
    return { error: "Bos dosya yuklenemez." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "Dosya boyutu 50 MB sinirini asiyor." };
  }

  const mimeType = file.type.trim().toLowerCase();
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { error: `Desteklenmeyen dosya tipi: ${mimeType || "unknown"}.` };
  }

  const extension = getExtension(file.name);
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { error: `Dosya uzantisi desteklenmiyor: ${extension || "unknown"}.` };
  }

  const compatibleExtensions = COMPATIBLE_EXTENSIONS_BY_MIME_TYPE[mimeType];
  if (compatibleExtensions && !compatibleExtensions.includes(extension)) {
    return { error: `Dosya uzantisi ve MIME tipi uyusmuyor: ${mimeType} / .${extension}.` };
  }

  return {
    mimeType,
    extension,
  };
};

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

    const rawAssetId = String(formData.get("assetId") ?? "").trim();
    const rawDocumentType = String(formData.get("documentType") ?? "").trim().toLowerCase();
    const file = getFileEntry(formData, "file");

    const assetId = normalizeUuid(rawAssetId);
    if (!assetId) {
      return NextResponse.json({ error: "Varlik kimligi gecersiz." }, { status: 400 });
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(rawDocumentType as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
      return NextResponse.json({ error: "Belge tipi gecersiz." }, { status: 400 });
    }

    const documentType = rawDocumentType as (typeof ALLOWED_DOCUMENT_TYPES)[number];

    if (!file) {
      return NextResponse.json({ error: "Yuklenecek dosya bulunamadi." }, { status: 400 });
    }

    const fileValidation = validateUploadFile(file);
    if ("error" in fileValidation) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
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
      requestedCount: 1,
    });

    if (!documentLimitCheck.allowed) {
      return NextResponse.json(
        { error: documentLimitCheck.errorMessage ?? "Plan limitine ulastiniz." },
        { status: 403 },
      );
    }

    const storagePath = buildStoragePath({
      userId: user.id,
      assetId,
      documentType,
      fileName: file.name,
      extension: fileValidation.extension,
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { contentType: fileValidation.mimeType, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: "Dosya yuklenemedi." }, { status: 500 });
    }

    const { data: insertedDocument, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        asset_id: assetId,
        service_log_id: null,
        document_type: documentType,
        file_name: normalizeDisplayFileName(file.name),
        storage_path: storagePath,
        file_size: file.size,
      })
      .select("id")
      .single();

    if (insertError || !insertedDocument?.id) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: insertError?.message ?? "Belge kaydi olusturulamadi." }, { status: 500 });
    }

    logAuditEvent({
      route: "/api/documents",
      userId: user.id,
      entityType: "documents",
      entityId: insertedDocument.id,
      action: "create",
      meta: { documentType },
    });

    return NextResponse.json(
      {
        ok: true,
        id: insertedDocument.id,
      },
      { status: 201 },
    );
  } catch (error) {
    logApiError({
      route: "/api/documents",
      method: "POST",
      userId,
      error,
      message: "Document upload request failed unexpectedly",
    });
    return NextResponse.json({ error: "Belge yukleme istegi islenemedi." }, { status: 500 });
  }
}

