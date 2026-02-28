import { createHash } from "crypto";

export type MediaEnrichmentJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type MediaEnrichmentJobRow = {
  id: string;
  status: MediaEnrichmentJobStatus;
};

export type MediaEnrichmentJobInsert = {
  user_id: string;
  service_log_id: string;
  document_ids: string[];
  idempotency_key: string;
};

export const IDEMPOTENCY_BUCKET_MS = 60_000;

export function buildMediaEnrichmentIdempotencyKey(params: {
  userId: string;
  serviceLogId: string;
  documentIds: string[];
  nowMs?: number;
}) {
  const bucket = Math.floor((params.nowMs ?? Date.now()) / IDEMPOTENCY_BUCKET_MS);
  const normalizedDocumentIds = [...params.documentIds].map((value) => value.trim().toLowerCase()).sort();
  const source = [params.userId.trim().toLowerCase(), params.serviceLogId.trim().toLowerCase(), normalizedDocumentIds.join(","), String(bucket)].join("|");
  return createHash("sha256").update(source).digest("hex");
}

type SupabaseLike = {
  from: (table: string) => any;
};

export async function queueMediaEnrichmentJob(
  supabase: SupabaseLike,
  row: MediaEnrichmentJobInsert,
): Promise<MediaEnrichmentJobRow | null> {
  const upsertRes = await supabase
    .from("media_enrichment_jobs")
    .upsert(row, {
      onConflict: "idempotency_key",
      ignoreDuplicates: true,
    })
    .select("id,status")
    .maybeSingle();

  if (upsertRes.error) {
    throw new Error(upsertRes.error.message);
  }

  return upsertRes.data;
}
