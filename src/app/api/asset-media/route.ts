import { randomUUID } from "crypto";
import path from "node:path";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import {
  ASSET_MEDIA_BUCKET,
  ASSET_MEDIA_LIMITS,
  ASSET_MEDIA_TOTAL_LIMIT_BYTES,
  ASSET_MEDIA_TOTAL_LIMIT_MESSAGE,
  getAssetMediaCountError,
  getFileExtension,
  isAssetMediaType,
  validateAssetMediaFile,
  type AssetMediaType,
} from "@/lib/assets/media-limits";
import { existsById } from "@/lib/repos/assets-repo";
import { canPlanUsePremiumMedia } from "@/lib/plans/premium-media";
import { requireRouteUser, type RouteAuthSuccess } from "@/lib/supabase/route-auth";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PREMIUM_REQUIRED_MESSAGE = "Ek medya özelliği Premium planında aktif.";

type UploadTask = {
  type: AssetMediaType;
  file: File;
};

const normalizeUuid = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

const getUploadedFiles = (formData: FormData, key: string) =>
  formData.getAll(key).filter((entry): entry is File => entry instanceof File && entry.size > 0);

const normalizePathSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "personal";

const resolveOrgId = (user: Pick<User, "app_metadata" | "user_metadata">) => {
  const appMetadata = user.app_metadata as Record<string, unknown> | null;
  const userMetadata = user.user_metadata as Record<string, unknown> | null;

  const raw =
    appMetadata?.org_id ??
    appMetadata?.organization_id ??
    userMetadata?.org_id ??
    userMetadata?.organization_id ??
    "personal";

  return normalizePathSegment(String(raw));
};

const buildStoragePath = (params: {
  orgId: string;
  userId: string;
  assetId: string;
  mediaType: AssetMediaType;
  extension: string;
}) =>
  path.posix.join(
    params.orgId,
    params.userId,
    params.assetId,
    params.mediaType,
    `${randomUUID()}.${params.extension}`,
  );

const rollbackUploadBatch = async (params: {
  supabase: RouteAuthSuccess["supabase"];
  userId: string;
  insertedRows: Array<{ id: string; storage_path: string }>;
  orphanedStoragePaths: string[];
}) => {
  const insertedIds = [...new Set(params.insertedRows.map((item) => item.id))];
  const insertedPaths = [...new Set(params.insertedRows.map((item) => item.storage_path))];
  const allPaths = [...new Set([...insertedPaths, ...params.orphanedStoragePaths])];

  if (insertedIds.length > 0) {
    await params.supabase
      .from("asset_media")
      .delete()
      .eq("user_id", params.userId)
      .in("id", insertedIds);
  }

  if (allPaths.length > 0) {
    await params.supabase.storage.from(ASSET_MEDIA_BUCKET).remove(allPaths);
  }
};

const isMissingAssetMediaTableError = (message: string | undefined) => {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("asset_media") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("not found in schema cache"))
  );
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

    if (!canPlanUsePremiumMedia(auth.profilePlan)) {
      return NextResponse.json({ error: PREMIUM_REQUIRED_MESSAGE }, { status: 403 });
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 });
    }

    const assetId = normalizeUuid(formData.get("assetId"));
    if (!assetId) {
      return NextResponse.json({ error: "Varlık kimliği geçersiz." }, { status: 400 });
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

    const imageFiles = getUploadedFiles(formData, "images");
    const videoFiles = getUploadedFiles(formData, "video");
    const audioFiles = getUploadedFiles(formData, "audio");

    const countsToUpload = {
      image: imageFiles.length,
      video: videoFiles.length,
      audio: audioFiles.length,
    };

    if (countsToUpload.image + countsToUpload.video + countsToUpload.audio === 0) {
      return NextResponse.json({ error: "Yüklenecek medya bulunamadı." }, { status: 400 });
    }

    if (countsToUpload.image > ASSET_MEDIA_LIMITS.image.maxFiles) {
      return NextResponse.json({ error: getAssetMediaCountError("image") }, { status: 400 });
    }

    if (countsToUpload.video > ASSET_MEDIA_LIMITS.video.maxFiles) {
      return NextResponse.json({ error: getAssetMediaCountError("video") }, { status: 400 });
    }

    if (countsToUpload.audio > ASSET_MEDIA_LIMITS.audio.maxFiles) {
      return NextResponse.json({ error: getAssetMediaCountError("audio") }, { status: 400 });
    }

    const { data: existingMediaRows, error: existingMediaError } = await supabase
      .from("asset_media")
      .select("id,type,size_bytes,storage_path")
      .eq("asset_id", assetId)
      .eq("user_id", user.id);

    if (existingMediaError) {
      if (isMissingAssetMediaTableError(existingMediaError.message)) {
        return NextResponse.json(
          { error: "asset_media tablosu bulunamadı. Migration çalıştırılmalı." },
          { status: 400 },
        );
      }

      return NextResponse.json({ error: existingMediaError.message }, { status: 400 });
    }

    const existingCounts = {
      image: 0,
      video: 0,
      audio: 0,
    };
    let existingTotalSize = 0;

    for (const row of existingMediaRows ?? []) {
      if (isAssetMediaType(row.type)) {
        existingCounts[row.type] += 1;
      }
      existingTotalSize += Number(row.size_bytes ?? 0);
    }

    if (existingCounts.image + countsToUpload.image > ASSET_MEDIA_LIMITS.image.maxFiles) {
      return NextResponse.json({ error: getAssetMediaCountError("image") }, { status: 400 });
    }

    if (existingCounts.video + countsToUpload.video > ASSET_MEDIA_LIMITS.video.maxFiles) {
      return NextResponse.json({ error: getAssetMediaCountError("video") }, { status: 400 });
    }

    if (existingCounts.audio + countsToUpload.audio > ASSET_MEDIA_LIMITS.audio.maxFiles) {
      return NextResponse.json({ error: getAssetMediaCountError("audio") }, { status: 400 });
    }

    const uploadTasks: UploadTask[] = [
      ...imageFiles.map((file) => ({ type: "image" as const, file })),
      ...videoFiles.map((file) => ({ type: "video" as const, file })),
      ...audioFiles.map((file) => ({ type: "audio" as const, file })),
    ];

    let requestedUploadBytes = 0;
    for (const task of uploadTasks) {
      const validationError = validateAssetMediaFile(task.file, task.type);
      if (validationError) {
        return NextResponse.json({ error: validationError.message }, { status: validationError.status });
      }
      requestedUploadBytes += task.file.size;
    }

    if (existingTotalSize + requestedUploadBytes > ASSET_MEDIA_TOTAL_LIMIT_BYTES) {
      return NextResponse.json({ error: ASSET_MEDIA_TOTAL_LIMIT_MESSAGE }, { status: 413 });
    }

    const orgId = resolveOrgId(user);
    const insertedRows: Array<{
      id: string;
      type: AssetMediaType;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
    }> = [];
    let firstUploadedImagePath: string | null = null;

    for (const task of uploadTasks) {
      const extension = getFileExtension(task.file.name);
      if (!extension) {
        return NextResponse.json({ error: "Dosya uzantısı bulunamadı." }, { status: 400 });
      }

      const storagePath = buildStoragePath({
        orgId,
        userId: user.id,
        assetId,
        mediaType: task.type,
        extension,
      });

      const mimeType = task.file.type.trim().toLowerCase();
      const { error: uploadError } = await supabase.storage.from(ASSET_MEDIA_BUCKET).upload(storagePath, task.file, {
        contentType: mimeType || undefined,
        upsert: false,
      });

      if (uploadError) {
        await rollbackUploadBatch({
          supabase,
          userId: user.id,
          insertedRows,
          orphanedStoragePaths: [],
        });
        return NextResponse.json({ error: `${task.type} dosyası yüklenemedi.` }, { status: 500 });
      }

      const { data: insertedRow, error: insertError } = await supabase
        .from("asset_media")
        .insert({
          user_id: user.id,
          asset_id: assetId,
          type: task.type,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: task.file.size,
        })
        .select("id,type,storage_path,mime_type,size_bytes")
        .single();

      if (insertError || !insertedRow?.id) {
        await rollbackUploadBatch({
          supabase,
          userId: user.id,
          insertedRows,
          orphanedStoragePaths: [storagePath],
        });
        return NextResponse.json({ error: "Medya kaydı oluşturulamadı." }, { status: 500 });
      }

      insertedRows.push({
        id: insertedRow.id,
        type: insertedRow.type,
        storage_path: insertedRow.storage_path,
        mime_type: insertedRow.mime_type,
        size_bytes: insertedRow.size_bytes,
      });

      if (!firstUploadedImagePath && task.type === "image") {
        firstUploadedImagePath = insertedRow.storage_path;
      }

      logAuditEvent({
        route: "/api/asset-media",
        userId: user.id,
        entityType: "asset_media",
        entityId: insertedRow.id,
        action: "create",
        meta: { assetId, mediaType: task.type },
      });
    }

    if (firstUploadedImagePath) {
      await supabase
        .from("assets")
        .update({ photo_path: firstUploadedImagePath })
        .eq("id", assetId)
        .eq("user_id", user.id);
    }

    return NextResponse.json(
      {
        ok: true,
        uploadedCount: insertedRows.length,
        media: insertedRows,
      },
      { status: 201 },
    );
  } catch (error) {
    logApiError({
      route: "/api/asset-media",
      method: "POST",
      userId,
      error,
      message: "Asset media upload request failed unexpectedly",
    });
    return NextResponse.json({ error: "Medya yükleme isteği işlenemedi." }, { status: 500 });
  }
}
