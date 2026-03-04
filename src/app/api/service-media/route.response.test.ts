import assert from "node:assert/strict";
import test from "node:test";
import { buildQueuedServiceMediaResponse } from "@/app/api/service-media/response";

test("buildQueuedServiceMediaResponse returns HTTP 202 immediately", async () => {
  const startedAt = performance.now();
  const response = buildQueuedServiceMediaResponse({
    uploadedCount: 1,
    queuedJob: { id: "job-123", status: "queued" },
    uploads: [
      {
        kind: "photo",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        size: 1024,
        storagePath: "user/asset/service-logs/log/photo/photo.jpg",
        metadata: {
          mime_type: "image/jpeg",
          extension: "jpg",
          size_bytes: 1024,
          last_modified_unix: 0,
        },
      },
    ],
  });
  const elapsedMs = performance.now() - startedAt;

  assert.equal(response.status, 202);
  assert.ok(elapsedMs < 100);

  const payload = (await response.json()) as {
    ok: boolean;
    uploadedCount: number;
    enrichment: string;
    jobId: string | null;
  };

  assert.equal(payload.ok, true);
  assert.equal(payload.uploadedCount, 1);
  assert.equal(payload.enrichment, "queued");
  assert.equal(payload.jobId, "job-123");
});
