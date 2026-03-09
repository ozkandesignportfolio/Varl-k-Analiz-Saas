import { NextResponse } from "next/server";
import type { MediaEnrichmentJobStatus } from "@/lib/service-media/enrichment-jobs";

type QueuedJob = {
  id: string;
  status: MediaEnrichmentJobStatus;
};

type MediaUpload = {
  kind: string;
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  metadata: Record<string, string | number | boolean | null>;
};

export function buildQueuedServiceMediaResponse(params: {
  uploadedCount: number;
  queuedJob: QueuedJob | null;
  uploads: MediaUpload[];
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
