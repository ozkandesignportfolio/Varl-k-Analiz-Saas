import { randomUUID } from "crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { existsById } from "@/lib/repos/assets-repo";
import { enforceLimit, isPlanLimitError, toPlanLimitErrorBody } from "@/lib/plans/limit-enforcer";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { fileConstraints, uuid } from "@/lib/validation";

export const runtime = "nodejs";

const STORAGE_BUCKET = "documents-private";
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ["garanti", "fatura", "servis_formu", "diğer"] as const;

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

type DeleteDocumentPayload = {
  id?: unknown;
};

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

const parseUuid = uuid();
const validateUploadFile = fileConstraints("dosya", MAX_FILE_SIZE_BYTES);

const readDeleteBody = async (request: Request) =>
  (await request.json().catch(() => null)) as DeleteDocumentPayload | null;

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
    const rl = enforceRateLimit({
      scope: "api",
      key: requestIp,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }

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

    const rawAssetId = String(formData.get("assetId") ?? "").trim();
    const rawDocumentType = String(formData.get("documentType") ?? "").trim().toLowerCase();
    const file = getFileEntry(formData, "file");

    const assetId = parseUuid(rawAssetId);
    if (!assetId) {
      return NextResponse.json({ error: "Varlık kimliği geçersiz." }, { status: 400 });
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(rawDocumentType as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
      return NextResponse.json({ error: "Belge tipi geçersiz." }, { status: 400 });
    }

    const documentType = rawDocumentType as (typeof ALLOWED_DOCUMENT_TYPES)[number];

    if (!file) {
      return NextResponse.json({ error: "Yüklenecek dosya bulunamadı." }, { status: 400 });
    }

    const fileValidation = validateUploadFile(file, {
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      allowedExtensions: ALLOWED_EXTENSIONS,
      compatibleExtensionsByMimeType: COMPATIBLE_EXTENSIONS_BY_MIME_TYPE,
    });
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

    await enforceLimit({
      client: supabase,
      userId: user.id,
      profilePlan: auth.profilePlan,
      resource: "documents",
      delta: 1,
    });

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
      return NextResponse.json({ error: "Dosya yüklenemedi." }, { status: 500 });
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
      return NextResponse.json({ error: insertError?.message ?? "Belge kaydı oluşturulamadı." }, { status: 500 });
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
    if (isPlanLimitError(error)) {
      return NextResponse.json(toPlanLimitErrorBody(error), { status: 403 });
    }

    logApiError({
      route: "/api/documents",
      method: "POST",
      userId,
      error,
      message: "Document upload request failed unexpectedly",
    });
    return NextResponse.json({ error: "Belge yükleme isteği işlenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null;
  try {
    const requestIp = (request as Request & { ip?: string }).ip ?? getRequestIp(request) ?? "anon";
    const rl = enforceRateLimit({
      scope: "api",
      key: requestIp,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
    }

    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }

    const { supabase, user } = auth;
    userId = user.id;

    const payload = await readDeleteBody(request);
    const documentId = parseUuid(payload?.id ?? new URL(request.url).searchParams.get("id"));
    if (!documentId) {
      return NextResponse.json({ error: "Belge kimliği geçersiz." }, { status: 400 });
    }

    const { data: existingDocument, error: existingDocumentError } = await supabase
      .from("documents")
      .select("id,storage_path")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingDocumentError) {
      return NextResponse.json({ error: existingDocumentError.message }, { status: 400 });
    }

    if (!existingDocument?.id) {
      return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
    }

    const { data: deletedDocument, error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    if (!deletedDocument?.id) {
      return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
    }

    let warning: string | null = null;
    const storagePath = String(existingDocument.storage_path ?? "").trim();
    if (storagePath) {
      const { error: storageDeleteError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      if (storageDeleteError) {
        warning = "Belge kaydı silindi fakat depolama dosyası temizlenemedi.";
        logApiError({
          route: "/api/documents",
          method: "DELETE",
          userId: user.id,
          status: 200,
          error: storageDeleteError,
          message: "Document record deleted but storage cleanup failed",
          meta: { documentId, storagePath },
        });
      }
    }

    logAuditEvent({
      route: "/api/documents",
      userId: user.id,
      entityType: "documents",
      entityId: deletedDocument.id,
      action: "delete",
    });

    return NextResponse.json(
      {
        ok: true,
        id: deletedDocument.id,
        warning,
      },
      { status: 200 },
    );
  } catch (error) {
    logApiError({
      route: "/api/documents",
      method: "DELETE",
      userId,
      error,
      message: "Document delete request failed unexpectedly",
    });
    return NextResponse.json({ error: "Belge silme isteği işlenemedi." }, { status: 500 });
  }
}
