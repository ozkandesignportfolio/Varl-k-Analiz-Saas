import "server-only";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";
import { logApiError } from "@/lib/api/logging";
import { enforceServiceRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

const SERVICE_MEDIA_JOBS_RATE_LIMIT_CAPACITY = 12;
const SERVICE_MEDIA_JOBS_RATE_LIMIT_REFILL_PER_SECOND = SERVICE_MEDIA_JOBS_RATE_LIMIT_CAPACITY / 60;

const hashSecretForRateLimitSubject = (secret: string) =>
  createHash("sha256").update(secret).digest("hex").slice(0, 32);

const readBody = async (request: Request) =>
  (await request.json().catch(() => null)) as
    | {
        limit?: unknown;
        concurrency?: unknown;
      }
    | null;

const getSupabaseUrl = () =>
  ServerEnv.NEXT_PUBLIC_SUPABASE_URL || ServerEnv.SUPABASE_URL || null;

const getServiceRoleClient = () => {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const getWorkerInvocation = () => {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    url: `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/media-enrichment`,
    serviceRoleKey,
  };
};

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

async function invokeCurrentWorker(body: Awaited<ReturnType<typeof readBody>>) {
  const worker = getWorkerInvocation();
  if (!worker) {
    return NextResponse.json({ error: "Service worker bağlantısı kurulamadı." }, { status: 503 });
  }

  const response = await fetch(worker.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${worker.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(asJsonObject(body) ?? {}),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  const payloadObject = asJsonObject(payload);

  if (!response.ok) {
    logApiError({
      route: "/api/service-media/jobs",
      method: "POST",
      userId: null,
      error: payloadObject?.error ?? `media_enrichment_upstream_${response.status}`,
      status: response.status,
      message: "Service media jobs route failed to invoke current worker",
    });

    const errorMessage =
      response.status >= 500
        ? "Service media worker tetiklenemedi."
        : typeof payloadObject?.error === "string" && payloadObject.error.trim()
          ? payloadObject.error
          : "Service media worker tetiklenemedi.";

    return NextResponse.json(
      { error: errorMessage },
      { status: response.status >= 500 ? 502 : response.status },
    );
  }

  return NextResponse.json(payloadObject ?? { ok: true }, { status: response.status });
}

export async function POST(request: Request) {
  const jobSecret = ServerEnv.SERVICE_MEDIA_JOB_SECRET;
  if (!jobSecret) {
    return NextResponse.json({ error: "SERVICE_MEDIA_JOB_SECRET tanımlı değil." }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-job-secret")?.trim();
  if (!providedSecret || providedSecret !== jobSecret) {
    return NextResponse.json({ error: "Yetkisiz job isteği." }, { status: 401 });
  }

  const serviceRoleClient = getServiceRoleClient();
  if (!serviceRoleClient) {
    return NextResponse.json({ error: "Service role bağlantısı kurulamadı." }, { status: 503 });
  }

  const rateLimit = await enforceServiceRateLimit({
    client: serviceRoleClient,
    scope: "api_service_media_jobs",
    subject: `worker_${hashSecretForRateLimitSubject(providedSecret)}`,
    capacity: SERVICE_MEDIA_JOBS_RATE_LIMIT_CAPACITY,
    refillPerSecond: SERVICE_MEDIA_JOBS_RATE_LIMIT_REFILL_PER_SECOND,
    ttlSeconds: 180,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla job tetiklendi. Lütfen tekrar deneyin." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
        },
      },
    );
  }

  try {
    const body = await readBody(request);
    return await invokeCurrentWorker(body);
  } catch (error) {
    logApiError({
      route: "/api/service-media/jobs",
      method: "POST",
      userId: null,
      error,
      message: "Service media jobs route failed unexpectedly",
    });
    return NextResponse.json({ error: "Job worker beklenmeyen sekilde hata verdi." }, { status: 500 });
  }
}
