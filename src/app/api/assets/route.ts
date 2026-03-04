import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { enforceUserRateLimit } from "@/lib/api/rate-limit";
import {
  listAssets,
  type AssetFilterMode,
  type AssetSortMode,
  type MaintenanceFilterMode,
  type WarrantyFilterMode,
} from "@/lib/repos/assets-repo";
import { enforceLimit, isPlanLimitError, toPlanLimitErrorBody } from "@/lib/plans/limit-enforcer";
import { requireRouteUser } from "@/lib/supabase/route-auth";
import { optionalText, paginationSchema, parseDateOnly, uuid } from "@/lib/validation";

type CreateAssetPayload = {
  name?: unknown;
  category?: unknown;
  serialNumber?: unknown;
  brand?: unknown;
  model?: unknown;
  purchaseDate?: unknown;
  warrantyEndDate?: unknown;
};

type UpdateAssetPayload = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  serialNumber?: unknown;
  brand?: unknown;
  model?: unknown;
  purchaseDate?: unknown;
  warrantyEndDate?: unknown;
  photoPath?: unknown;
};

type DeleteAssetPayload = {
  id?: unknown;
};

const MAX_NAME_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 80;
const MAX_SERIAL_NUMBER_LENGTH = 160;
const MAX_BRAND_LENGTH = 120;
const MAX_MODEL_LENGTH = 120;
const MAX_PHOTO_PATH_LENGTH = 1024;
const ALLOWED_SORTS: AssetSortMode[] = ["updated", "cost", "score"];
const ALLOWED_ASSET_FILTERS: AssetFilterMode[] = ["active", "passive"];
const ALLOWED_WARRANTY_FILTERS: WarrantyFilterMode[] = ["active", "expiring", "expired"];
const ALLOWED_MAINTENANCE_FILTERS: MaintenanceFilterMode[] = ["upcoming", "overdue"];
const ASSETS_READ_RATE_LIMIT_CAPACITY = 120;
const ASSETS_READ_RATE_LIMIT_REFILL_PER_SECOND = ASSETS_READ_RATE_LIMIT_CAPACITY / 60;
const ASSETS_WRITE_RATE_LIMIT_CAPACITY = 30;
const ASSETS_WRITE_RATE_LIMIT_REFILL_PER_SECOND = ASSETS_WRITE_RATE_LIMIT_CAPACITY / 60;

const readBody = async <T extends object>(request: Request) =>
  (await request.json().catch(() => null)) as T | null;

const applyAssetsRateLimit = async (params: {
  client: unknown;
  userId: string;
  scope: "read" | "write";
  capacity: number;
  refillPerSecond: number;
}) =>
  enforceUserRateLimit({
    client: params.client,
    scope: `api_assets_${params.scope}`,
    userId: params.userId,
    capacity: params.capacity,
    refillPerSecond: params.refillPerSecond,
    ttlSeconds: 180,
  });

const parseUuid = uuid();
const parseAssetPagination = paginationSchema(
  (params) => {
    const cursorValue = params.get("cursorValue");
    const cursorIdRaw = params.get("cursorId");
    const cursorSortRaw = params.get("cursorSort");
    const cursorId = cursorIdRaw ? parseUuid(cursorIdRaw) : null;
    const cursorSort = ALLOWED_SORTS.includes(cursorSortRaw as AssetSortMode)
      ? (cursorSortRaw as AssetSortMode)
      : null;

    if (!cursorValue || !cursorId || !cursorSort) {
      return null;
    }

    return { value: cursorValue, id: cursorId, sort: cursorSort };
  },
  { fallback: 30, max: 100 },
);
const parseNameText = optionalText(MAX_NAME_LENGTH);
const parseCategoryText = optionalText(MAX_CATEGORY_LENGTH);
const parseSerialNumberText = optionalText(MAX_SERIAL_NUMBER_LENGTH);
const parseBrandText = optionalText(MAX_BRAND_LENGTH);
const parseModelText = optionalText(MAX_MODEL_LENGTH);
const parseDateText = optionalText(10);
const parsePhotoPathText = optionalText(MAX_PHOTO_PATH_LENGTH);

export async function GET(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const rateLimit = await applyAssetsRateLimit({
      client: auth.supabase,
      userId: auth.user.id,
      scope: "read",
      capacity: ASSETS_READ_RATE_LIMIT_CAPACITY,
      refillPerSecond: ASSETS_READ_RATE_LIMIT_REFILL_PER_SECOND,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Cok fazla varlik listeleme istegi gonderildi. Lutfen tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const params = new URL(request.url).searchParams;
    const { pageSize, cursor } = parseAssetPagination(params);
    const search = params.get("search")?.trim() || undefined;
    const category = params.get("category")?.trim() || undefined;

    const sortRaw = params.get("sort");
    const sort = ALLOWED_SORTS.includes(sortRaw as AssetSortMode) ? (sortRaw as AssetSortMode) : "updated";

    const assetFilterRaw = params.get("assetFilter");
    const assetFilter = ALLOWED_ASSET_FILTERS.includes(assetFilterRaw as AssetFilterMode)
      ? (assetFilterRaw as AssetFilterMode)
      : undefined;

    const warrantyFilterRaw = params.get("warrantyFilter");
    const warrantyFilter = ALLOWED_WARRANTY_FILTERS.includes(warrantyFilterRaw as WarrantyFilterMode)
      ? (warrantyFilterRaw as WarrantyFilterMode)
      : undefined;

    const maintenanceFilterRaw = params.get("maintenanceFilter");
    const maintenanceFilter = ALLOWED_MAINTENANCE_FILTERS.includes(
      maintenanceFilterRaw as MaintenanceFilterMode,
    )
      ? (maintenanceFilterRaw as MaintenanceFilterMode)
      : undefined;

    const { data, error } = await listAssets(auth.supabase, {
      userId: auth.user.id,
      cursor,
      pageSize,
      search,
      sort,
      category,
      assetFilter,
      warrantyFilter,
      maintenanceFilter,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data ?? { rows: [], nextCursor: null, hasMore: false }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/assets",
      method: "GET",
      userId,
      error,
      message: "Assets list request failed unexpectedly",
    });
    return NextResponse.json({ error: "Varlik listesi yuklenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const rateLimit = await applyAssetsRateLimit({
      client: auth.supabase,
      userId: auth.user.id,
      scope: "write",
      capacity: ASSETS_WRITE_RATE_LIMIT_CAPACITY,
      refillPerSecond: ASSETS_WRITE_RATE_LIMIT_REFILL_PER_SECOND,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Cok fazla varlik olusturma istegi gonderildi. Lutfen tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const payload = await readBody<CreateAssetPayload>(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const nameResult = parseNameText(payload.name, { required: true });
    const categoryResult = parseCategoryText(payload.category, { required: true });
    const serialNumberResult = parseSerialNumberText(payload.serialNumber);
    const brandResult = parseBrandText(payload.brand);
    const modelResult = parseModelText(payload.model);
    const purchaseDateResult = parseDateText(payload.purchaseDate);
    const warrantyEndDateResult = parseDateText(payload.warrantyEndDate);

    if (
      nameResult.invalidType ||
      categoryResult.invalidType ||
      serialNumberResult.invalidType ||
      brandResult.invalidType ||
      modelResult.invalidType ||
      purchaseDateResult.invalidType ||
      warrantyEndDateResult.invalidType
    ) {
      return NextResponse.json({ error: "İstek alanı tipleri geçersiz." }, { status: 400 });
    }

    if (nameResult.missing || categoryResult.missing) {
      return NextResponse.json({ error: "Varlik adi ve kategori zorunludur." }, { status: 400 });
    }

    if (
      nameResult.tooLong ||
      categoryResult.tooLong ||
      serialNumberResult.tooLong ||
      brandResult.tooLong ||
      modelResult.tooLong ||
      purchaseDateResult.tooLong ||
      warrantyEndDateResult.tooLong
    ) {
      return NextResponse.json({ error: "Metin alanlarından biri çok uzun." }, { status: 400 });
    }

    const name = nameResult.value;
    const category = categoryResult.value;
    if (!name || !category) {
      return NextResponse.json({ error: "Varlik adi ve kategori zorunludur." }, { status: 400 });
    }

    const purchaseDate = purchaseDateResult.value;
    const warrantyEndDate = warrantyEndDateResult.value;

    const purchaseDateParsed = purchaseDate ? parseDateOnly(purchaseDate) : null;
    const warrantyEndDateParsed = warrantyEndDate ? parseDateOnly(warrantyEndDate) : null;
    if ((purchaseDate && !purchaseDateParsed) || (warrantyEndDate && !warrantyEndDateParsed)) {
      return NextResponse.json({ error: "Tarih alanı geçersiz." }, { status: 400 });
    }

    if (purchaseDateParsed && warrantyEndDateParsed && warrantyEndDateParsed < purchaseDateParsed) {
      return NextResponse.json(
        { error: "Garanti bitiş tarihi satın alma tarihinden önce olamaz." },
        { status: 400 },
      );
    }

    await enforceLimit({
      client: auth.supabase,
      userId: auth.user.id,
      profilePlan: auth.profilePlan,
      resource: "assets",
      delta: 1,
    });

    const { data, error } = await auth.supabase
      .from("assets")
      .insert({
        user_id: auth.user.id,
        name,
        category,
        serial_number: serialNumberResult.value,
        brand: brandResult.value,
        model: modelResult.value,
        purchase_date: purchaseDateParsed,
        warranty_end_date: warrantyEndDateParsed,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      return NextResponse.json({ error: error?.message ?? "Varlık oluşturulamadı." }, { status: 400 });
    }

    logAuditEvent({
      route: "/api/assets",
      userId: auth.user.id,
      entityType: "assets",
      entityId: data.id,
      action: "create",
    });

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    if (isPlanLimitError(error)) {
      return NextResponse.json(toPlanLimitErrorBody(error), { status: 403 });
    }

    logApiError({
      route: "/api/assets",
      method: "POST",
      userId,
      error,
      message: "Asset create request failed unexpectedly",
    });
    return NextResponse.json({ error: "Varlık isteği işlenemedi." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const rateLimit = await applyAssetsRateLimit({
      client: auth.supabase,
      userId: auth.user.id,
      scope: "write",
      capacity: ASSETS_WRITE_RATE_LIMIT_CAPACITY,
      refillPerSecond: ASSETS_WRITE_RATE_LIMIT_REFILL_PER_SECOND,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Cok fazla varlik guncelleme istegi gonderildi. Lutfen tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const payload = await readBody<UpdateAssetPayload>(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const assetId = parseUuid(payload.id);
    if (!assetId) {
      return NextResponse.json({ error: "Varlık kimliği geçersiz." }, { status: 400 });
    }

    const hasName = payload.name !== undefined;
    const hasCategory = payload.category !== undefined;
    const hasSerialNumber = payload.serialNumber !== undefined;
    const hasBrand = payload.brand !== undefined;
    const hasModel = payload.model !== undefined;
    const hasPurchaseDate = payload.purchaseDate !== undefined;
    const hasWarrantyEndDate = payload.warrantyEndDate !== undefined;
    const hasPhotoPath = payload.photoPath !== undefined;

    if (
      !hasName &&
      !hasCategory &&
      !hasSerialNumber &&
      !hasBrand &&
      !hasModel &&
      !hasPurchaseDate &&
      !hasWarrantyEndDate &&
      !hasPhotoPath
    ) {
      return NextResponse.json({ error: "Güncellenecek alan bulunamadı." }, { status: 400 });
    }

    const patch: Record<string, string | null> = {};

    if (hasName) {
      const nameResult = parseNameText(payload.name, { required: true });
      if (nameResult.invalidType || nameResult.missing || nameResult.tooLong) {
        return NextResponse.json({ error: "Varlık adı geçersiz." }, { status: 400 });
      }
      patch.name = nameResult.value;
    }

    if (hasCategory) {
      const categoryResult = parseCategoryText(payload.category, { required: true });
      if (categoryResult.invalidType || categoryResult.missing || categoryResult.tooLong) {
        return NextResponse.json({ error: "Kategori geçersiz." }, { status: 400 });
      }
      patch.category = categoryResult.value;
    }

    if (hasSerialNumber) {
      const serialNumberResult = parseSerialNumberText(payload.serialNumber);
      if (serialNumberResult.invalidType || serialNumberResult.tooLong) {
        return NextResponse.json({ error: "Seri numarası geçersiz." }, { status: 400 });
      }
      patch.serial_number = serialNumberResult.value;
    }

    if (hasBrand) {
      const brandResult = parseBrandText(payload.brand);
      if (brandResult.invalidType || brandResult.tooLong) {
        return NextResponse.json({ error: "Marka alanı geçersiz." }, { status: 400 });
      }
      patch.brand = brandResult.value;
    }

    if (hasModel) {
      const modelResult = parseModelText(payload.model);
      if (modelResult.invalidType || modelResult.tooLong) {
        return NextResponse.json({ error: "Model alanı geçersiz." }, { status: 400 });
      }
      patch.model = modelResult.value;
    }

    if (hasPurchaseDate) {
      const purchaseDateResult = parseDateText(payload.purchaseDate);
      if (purchaseDateResult.invalidType || purchaseDateResult.tooLong) {
        return NextResponse.json({ error: "Satın alma tarihi geçersiz." }, { status: 400 });
      }
      const purchaseDateParsed = purchaseDateResult.value ? parseDateOnly(purchaseDateResult.value) : null;
      if (purchaseDateResult.value && !purchaseDateParsed) {
        return NextResponse.json({ error: "Satın alma tarihi geçersiz." }, { status: 400 });
      }
      patch.purchase_date = purchaseDateParsed;
    }

    if (hasWarrantyEndDate) {
      const warrantyEndDateResult = parseDateText(payload.warrantyEndDate);
      if (warrantyEndDateResult.invalidType || warrantyEndDateResult.tooLong) {
        return NextResponse.json({ error: "Garanti bitiş tarihi geçersiz." }, { status: 400 });
      }
      const warrantyEndDateParsed = warrantyEndDateResult.value
        ? parseDateOnly(warrantyEndDateResult.value)
        : null;
      if (warrantyEndDateResult.value && !warrantyEndDateParsed) {
        return NextResponse.json({ error: "Garanti bitiş tarihi geçersiz." }, { status: 400 });
      }
      patch.warranty_end_date = warrantyEndDateParsed;
    }

    if (hasPhotoPath) {
      const photoPathResult = parsePhotoPathText(payload.photoPath);
      if (photoPathResult.invalidType || photoPathResult.tooLong) {
        return NextResponse.json({ error: "Fotoğraf yolu geçersiz." }, { status: 400 });
      }
      patch.photo_path = photoPathResult.value;
    }

    const { data: existingAsset, error: existingAssetError } = await auth.supabase
      .from("assets")
      .select("id,purchase_date,warranty_end_date")
      .eq("id", assetId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (existingAssetError) {
      return NextResponse.json({ error: existingAssetError.message }, { status: 400 });
    }

    if (!existingAsset?.id) {
      return NextResponse.json({ error: "Varlık bulunamadı." }, { status: 404 });
    }

    const nextPurchaseDate = (patch.purchase_date ?? existingAsset.purchase_date) || null;
    const nextWarrantyEndDate = (patch.warranty_end_date ?? existingAsset.warranty_end_date) || null;
    if (nextPurchaseDate && nextWarrantyEndDate && nextWarrantyEndDate < nextPurchaseDate) {
      return NextResponse.json(
        { error: "Garanti bitiş tarihi satın alma tarihinden önce olamaz." },
        { status: 400 },
      );
    }

    const { error, data } = await auth.supabase
      .from("assets")
      .update(patch)
      .eq("id", assetId)
      .eq("user_id", auth.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: "Varlık bulunamadı." }, { status: 404 });
    }

    logAuditEvent({
      route: "/api/assets",
      userId: auth.user.id,
      entityType: "assets",
      entityId: data.id,
      action: "update",
      meta: { fields: Object.keys(patch) },
    });

    return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/assets",
      method: "PATCH",
      userId,
      error,
      message: "Asset update request failed unexpectedly",
    });
    return NextResponse.json({ error: "Varlık göncelleme isteği işlenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const rateLimit = await applyAssetsRateLimit({
      client: auth.supabase,
      userId: auth.user.id,
      scope: "write",
      capacity: ASSETS_WRITE_RATE_LIMIT_CAPACITY,
      refillPerSecond: ASSETS_WRITE_RATE_LIMIT_REFILL_PER_SECOND,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Cok fazla varlik silme istegi gonderildi. Lutfen tekrar deneyin." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const payload = await readBody<DeleteAssetPayload>(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const assetId = parseUuid(payload.id);
    if (!assetId) {
      return NextResponse.json({ error: "Varlık kimliği geçersiz." }, { status: 400 });
    }

    const { error, data } = await auth.supabase
      .from("assets")
      .delete()
      .eq("id", assetId)
      .eq("user_id", auth.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: "Varlık bulunamadı." }, { status: 404 });
    }

    logAuditEvent({
      route: "/api/assets",
      userId: auth.user.id,
      entityType: "assets",
      entityId: data.id,
      action: "delete",
    });

    return NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  } catch (error) {
    logApiError({
      route: "/api/assets",
      method: "DELETE",
      userId,
      error,
      message: "Asset delete request failed unexpectedly",
    });
    return NextResponse.json({ error: "Varlık silme isteği işlenemedi." }, { status: 500 });
  }
}
