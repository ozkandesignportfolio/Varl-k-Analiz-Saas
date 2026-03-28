import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api/logging";
import { toPublicErrorBody } from "@/lib/api/public-error";
import { enforceRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { listReports } from "@/lib/repos/reports-repo";
import { requireRouteUser } from "@/lib/supabase/route-auth";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizePageSize = (value: string | null, fallback: number, max: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, parsed);
};

const normalizeUuid = (value: string | null) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(normalized)) {
    return null;
  }

  return normalized;
};

const normalizeDateOnly = (value: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!DATE_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
};

const parseBoolean = (value: string | null, fallback: boolean) => {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return fallback;
};

export async function GET(request: Request) {
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
    userId = auth.user.id;

    const params = new URL(request.url).searchParams;
    const fromRaw = params.get("from");
    const toRaw = params.get("to");
    const from = normalizeDateOnly(fromRaw);
    const to = normalizeDateOnly(toRaw);

    if (fromRaw && !from) {
      return NextResponse.json({ error: "Baslangic tarihi gecersiz." }, { status: 400 });
    }
    if (toRaw && !to) {
      return NextResponse.json({ error: "Bitis tarihi gecersiz." }, { status: 400 });
    }

    const pageSize = normalizePageSize(params.get("pageSize"), 100, 200);
    const includeServices = parseBoolean(params.get("includeServices"), true);
    const includeDocuments = parseBoolean(params.get("includeDocuments"), true);

    const servicesCursorCreatedAtRaw = params.get("servicesCursorCreatedAt");
    const servicesCursorIdRaw = params.get("servicesCursorId");
    const documentsCursorUploadedAtRaw = params.get("documentsCursorUploadedAt");
    const documentsCursorIdRaw = params.get("documentsCursorId");

    const servicesCursorCreatedAt =
      servicesCursorCreatedAtRaw && !Number.isNaN(new Date(servicesCursorCreatedAtRaw).getTime())
        ? servicesCursorCreatedAtRaw
        : null;
    const servicesCursorId = normalizeUuid(servicesCursorIdRaw);
    const documentsCursorUploadedAt =
      documentsCursorUploadedAtRaw && !Number.isNaN(new Date(documentsCursorUploadedAtRaw).getTime())
        ? documentsCursorUploadedAtRaw
        : null;
    const documentsCursorId = normalizeUuid(documentsCursorIdRaw);

    const cursor = {
      services:
        servicesCursorCreatedAt && servicesCursorId
          ? { createdAt: servicesCursorCreatedAt, id: servicesCursorId }
          : null,
      documents:
        documentsCursorUploadedAt && documentsCursorId
          ? { uploadedAt: documentsCursorUploadedAt, id: documentsCursorId }
          : null,
    };

    const { data, error } = await listReports(auth.supabase, {
      userId: auth.user.id,
      from: from ?? undefined,
      to: to ?? undefined,
      cursor,
      pageSize,
      includeServices,
      includeDocuments,
    });

    if (error) {
      logApiError({
        route: "/api/reports",
        method: "GET",
        status: 400,
        userId: auth.user.id,
        error,
        message: "Reports repository query failed",
      });
      return NextResponse.json(
        toPublicErrorBody("REPORTS_LIST_FAILED", "Rapor satirlari su anda alinamadi."),
        { status: 400 },
      );
    }

    return NextResponse.json(
      data ?? {
        services: [],
        documents: [],
        nextCursor: { services: null, documents: null },
        hasMore: false,
        hasMoreServices: false,
        hasMoreDocuments: false,
      },
      { status: 200 },
    );
  } catch (error) {
    logApiError({
      route: "/api/reports",
      method: "GET",
      userId,
      error,
      message: "Reports list request failed unexpectedly",
    });
    return NextResponse.json({ error: "Rapor satirlari yuklenemedi." }, { status: 500 });
  }
}
