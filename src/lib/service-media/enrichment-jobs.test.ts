import assert from "node:assert/strict";
import test from "node:test";
import { buildMediaEnrichmentIdempotencyKey, queueMediaEnrichmentJob } from "@/lib/service-media/enrichment-jobs";

test("buildMediaEnrichmentIdempotencyKey is stable for sorted document ids in the same bucket", () => {
  const nowMs = 1_700_000_000_000;
  const left = buildMediaEnrichmentIdempotencyKey({
    userId: "USER-1",
    serviceLogId: "LOG-1",
    documentIds: ["doc-c", "doc-a", "doc-b"],
    nowMs,
  });
  const right = buildMediaEnrichmentIdempotencyKey({
    userId: "user-1",
    serviceLogId: "log-1",
    documentIds: ["doc-b", "doc-c", "doc-a"],
    nowMs: nowMs + 59_000,
  });
  assert.equal(left, right);
});

test("queueMediaEnrichmentJob returns null when upsert is ignored by idempotency conflict", async () => {
  const supabaseMock = {
    from: () => ({
      upsert: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  };

  const result = await queueMediaEnrichmentJob(supabaseMock as never, {
    user_id: "user-1",
    service_log_id: "log-1",
    document_ids: ["doc-1"],
    idempotency_key: "idem-1",
  });

  assert.equal(result, null);
});
