import { NextResponse } from "next/server";
import type { MediaEnrichmentJobStatus } from "@/lib/service-media/enrichment-jobs";

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

export function buildQueuedServiceMediaResponse(params: {
  uploadedCount: number;
  queuedJob: QueueRow | null;
  uploads: MediaUploadResult[];
}) {
  return NextResponse.json(
    {
      ok: true,
      uploadedCount: params.uploadedCount,
      enrichment: params.queuedJob?.status ?? "queued",
      jobId: params.queuedJob?.id ?? null,
      media: params.uploads.map((item) => ({
        kind: item.kind,
        fileName: item.fileName,
        mimeType: item.mimeType,
        size: item.size,
        storagePath: item.storagePath,
        metadata: item.metadata,
      })),
    },
    { status: 202 },
  );
}
