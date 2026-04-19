import "server-only";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ServerEnv } from "@/lib/env/server-env";
import { logApiError } from "@/lib/api/logging";
import { enforceServiceRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

const AUTOMATION_DISPATCH_RATE_LIMIT_CAPACITY = 12;
const AUTOMATION_DISPATCH_RATE_LIMIT_REFILL_PER_SECOND = AUTOMATION_DISPATCH_RATE_LIMIT_CAPACITY / 60;

const hashSecretForRateLimitSubject = (secret: string) =>
  createHash("sha256").update(secret).digest("hex").slice(0, 32);

const asJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readBody = async (request: Request) => {
  const body = (await request.json().catch(() => null)) as unknown;
  return asJsonObject(body) ?? {};
};

const getSupabaseUrl = () =>
  ServerEnv.NEXT_PUBLIC_SUPABASE_URL || ServerEnv.SUPABASE_URL || null;

const isConfiguredSecret = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return false;
  }

  return ![/^your[_-]/i, /^replace[_-]?me$/i, /^changeme$/i, /^placeholder$/i, /^example/i].some((pattern) =>
    pattern.test(normalized),
  );
};

const getDispatchConfigState = () => {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = ServerEnv.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = ServerEnv.AUTOMATION_CRON_SECRET || ServerEnv.CRON_SECRET || null;
  const missingEnv: string[] = [];

  if (!supabaseUrl) {
    missingEnv.push("NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL");
  }

  if (!isConfiguredSecret(serviceRoleKey)) {
    missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!cronSecret) {
    missingEnv.push("AUTOMATION_CRON_SECRET|CRON_SECRET");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    cronSecret,
    missingEnv,
  };
};

type WorkerInvocation =
  | {
      url: string;
      serviceRoleKey: string;
      cronSecret: string;
      missingEnv: string[];
    }
  | {
      missingEnv: string[];
    };

const getServiceRoleClient = () => {
  const { supabaseUrl, serviceRoleKey } = getDispatchConfigState();

  if (!supabaseUrl || !isConfiguredSecret(serviceRoleKey)) {
    return null;
  }

  const validatedServiceRoleKey = serviceRoleKey as string;

  return createSupabaseClient(supabaseUrl, validatedServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const getWorkerInvocation = (): WorkerInvocation => {
  const { supabaseUrl, serviceRoleKey, cronSecret, missingEnv } = getDispatchConfigState();

  if (!supabaseUrl || !isConfiguredSecret(serviceRoleKey) || !cronSecret) {
    return { missingEnv };
  }

  return {
    url: `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/automation-dispatcher`,
    serviceRoleKey: serviceRoleKey as string,
    cronSecret: cronSecret as string,
    missingEnv,
  };
};

const readProvidedSecret = (request: Request) => {
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (headerSecret) {
    return headerSecret;
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return "";
};

async function invokeCurrentWorker(body: Record<string, unknown>) {
  const worker = getWorkerInvocation();
  if (!("url" in worker)) {
    return NextResponse.json(
      {
        error: "Automation worker baglantisi kurulamadi.",
        missing_env: worker.missingEnv,
      },
      { status: 503 },
    );
  }

  const response = await fetch(worker.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${worker.serviceRoleKey}`,
      "Content-Type": "application/json",
      "x-cron-secret": worker.cronSecret,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  const payloadObject = asJsonObject(payload);

  if (!response.ok) {
    logApiError({
      route: "/api/automation/dispatch",
      method: "POST",
      userId: null,
      error: payloadObject?.error ?? `automation_dispatcher_upstream_${response.status}`,
      status: response.status,
      message: "Automation dispatch route failed to invoke current worker",
      meta: {
        upstreamStatus: response.status,
      },
    });

    const errorMessage =
      response.status >= 500
        ? "Automation worker tetiklenemedi."
        : typeof payloadObject?.error === "string" && payloadObject.error.trim()
          ? payloadObject.error
          : "Automation worker tetiklenemedi.";

    return NextResponse.json(
      { error: errorMessage },
      { status: response.status >= 500 ? 502 : response.status },
    );
  }

  return NextResponse.json(payloadObject ?? { ok: true }, { status: response.status });
}

async function handleDispatch(request: Request, body: Record<string, unknown>) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. Prefer the existing
  // AUTOMATION_CRON_SECRET and allow CRON_SECRET as a compatible fallback.
  const { cronSecret, missingEnv } = getDispatchConfigState();
  if (!cronSecret) {
    return NextResponse.json(
      {
        error: "AUTOMATION_CRON_SECRET tanimli degil.",
        missing_env: missingEnv,
      },
      { status: 503 },
    );
  }

  const providedSecret = readProvidedSecret(request);
  if (!providedSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Yetkisiz job istegi." }, { status: 401 });
  }

  const serviceRoleClient = getServiceRoleClient();
  if (!serviceRoleClient) {
    logApiError({
      route: "/api/automation/dispatch",
      method: request.method,
      userId: null,
      error: "invalid_supabase_service_role_key",
      status: 503,
      message: "Automation dispatch route is missing a valid service role configuration",
      meta: {
        missingEnv,
      },
    });
    return NextResponse.json(
      {
        error: "Service role baglantisi kurulamadi.",
        missing_env: missingEnv,
      },
      { status: 503 },
    );
  }

  const rateLimit = await enforceServiceRateLimit({
    client: serviceRoleClient,
    scope: "api_automation_dispatch",
    subject: `worker_${hashSecretForRateLimitSubject(providedSecret)}`,
    capacity: AUTOMATION_DISPATCH_RATE_LIMIT_CAPACITY,
    refillPerSecond: AUTOMATION_DISPATCH_RATE_LIMIT_REFILL_PER_SECOND,
    ttlSeconds: 180,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Cok fazla automation dispatch tetiklendi. Lutfen tekrar deneyin." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
        },
      },
    );
  }

  try {
    return await invokeCurrentWorker(body);
  } catch (error) {
    logApiError({
      route: "/api/automation/dispatch",
      method: "POST",
      userId: null,
      error,
      message: "Automation dispatch route failed unexpectedly",
    });
    return NextResponse.json({ error: "Automation dispatch istegi islenemedi." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleDispatch(request, {});
}

export async function POST(request: Request) {
  return handleDispatch(request, await readBody(request));
}
