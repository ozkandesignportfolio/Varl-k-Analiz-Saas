import { NextResponse } from "next/server";
import { logApiError, logAuditEvent } from "@/lib/api/logging";
import { countByUser as countAssetsByUser } from "@/lib/repos/assets-repo";
import { canCreateAsset } from "@/lib/plans/plan-config";
import { getPlanConfigFromProfilePlan } from "@/lib/plans/profile-plan";
import { requireRouteUser } from "@/lib/supabase/route-auth";

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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 80;
const MAX_SERIAL_NUMBER_LENGTH = 160;
const MAX_BRAND_LENGTH = 120;
const MAX_MODEL_LENGTH = 120;
const MAX_PHOTO_PATH_LENGTH = 1024;

const readBody = async <T extends object>(request: Request) =>
  (await request.json().catch(() => null)) as T | null;

const normalizeUuid = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const parseDateOnly = (value: string) => {
  const trimmed = value.trim();
  if (!DATE_PATTERN.test(trimmed)) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = trimmed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
};

const readOptionalText = (value: unknown, maxLength: number) => {
  if (value === null || value === undefined) {
    return { value: null as string | null };
  }

  if (typeof value !== "string") {
    return { value: null as string | null, invalidType: true };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null as string | null };
  }

  if (trimmed.length > maxLength) {
    return { value: null as string | null, tooLong: true };
  }

  return { value: trimmed };
};

const readRequiredText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return { value: "", invalidType: true };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: "", missing: true };
  }

  if (trimmed.length > maxLength) {
    return { value: "", tooLong: true };
  }

  return { value: trimmed };
};

export async function POST(request: Request) {
  let userId: string | null = null;
  try {
    const auth = await requireRouteUser(request);
    if ("response" in auth) {
      return auth.response;
    }
    userId = auth.user.id;

    const payload = await readBody<CreateAssetPayload>(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const nameResult = readRequiredText(payload.name, MAX_NAME_LENGTH);
    const categoryResult = readRequiredText(payload.category, MAX_CATEGORY_LENGTH);
    const serialNumberResult = readOptionalText(payload.serialNumber, MAX_SERIAL_NUMBER_LENGTH);
    const brandResult = readOptionalText(payload.brand, MAX_BRAND_LENGTH);
    const modelResult = readOptionalText(payload.model, MAX_MODEL_LENGTH);
    const purchaseDateResult = readOptionalText(payload.purchaseDate, 10);
    const warrantyEndDateResult = readOptionalText(payload.warrantyEndDate, 10);

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

    if (auth.profilePlan !== "premium") {
      const userPlan = getPlanConfigFromProfilePlan(auth.profilePlan);
      const { data: currentAssetCount, error: countError } = await countAssetsByUser(auth.supabase, {
        userId: auth.user.id,
      });

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 400 });
      }

      const assetLimitCheck = canCreateAsset({
        planConfig: userPlan,
        currentCount: currentAssetCount ?? 0,
      });

      if (!assetLimitCheck.allowed) {
        return NextResponse.json(
          {
            error: assetLimitCheck.errorMessage ?? "Plan limitine ulaştınız.",
          },
          { status: 403 },
        );
      }
    }

    const { data, error } = await auth.supabase
      .from("assets")
      .insert({
        user_id: auth.user.id,
        name: nameResult.value,
        category: categoryResult.value,
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

    const payload = await readBody<UpdateAssetPayload>(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const assetId = normalizeUuid(payload.id);
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
      const nameResult = readRequiredText(payload.name, MAX_NAME_LENGTH);
      if (nameResult.invalidType || nameResult.missing || nameResult.tooLong) {
        return NextResponse.json({ error: "Varlık adı geçersiz." }, { status: 400 });
      }
      patch.name = nameResult.value;
    }

    if (hasCategory) {
      const categoryResult = readRequiredText(payload.category, MAX_CATEGORY_LENGTH);
      if (categoryResult.invalidType || categoryResult.missing || categoryResult.tooLong) {
        return NextResponse.json({ error: "Kategori geçersiz." }, { status: 400 });
      }
      patch.category = categoryResult.value;
    }

    if (hasSerialNumber) {
      const serialNumberResult = readOptionalText(payload.serialNumber, MAX_SERIAL_NUMBER_LENGTH);
      if (serialNumberResult.invalidType || serialNumberResult.tooLong) {
        return NextResponse.json({ error: "Seri numarası geçersiz." }, { status: 400 });
      }
      patch.serial_number = serialNumberResult.value;
    }

    if (hasBrand) {
      const brandResult = readOptionalText(payload.brand, MAX_BRAND_LENGTH);
      if (brandResult.invalidType || brandResult.tooLong) {
        return NextResponse.json({ error: "Marka alanı geçersiz." }, { status: 400 });
      }
      patch.brand = brandResult.value;
    }

    if (hasModel) {
      const modelResult = readOptionalText(payload.model, MAX_MODEL_LENGTH);
      if (modelResult.invalidType || modelResult.tooLong) {
        return NextResponse.json({ error: "Model alanı geçersiz." }, { status: 400 });
      }
      patch.model = modelResult.value;
    }

    if (hasPurchaseDate) {
      const purchaseDateResult = readOptionalText(payload.purchaseDate, 10);
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
      const warrantyEndDateResult = readOptionalText(payload.warrantyEndDate, 10);
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
      const photoPathResult = readOptionalText(payload.photoPath, MAX_PHOTO_PATH_LENGTH);
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

    const payload = await readBody<DeleteAssetPayload>(request);
    if (!payload) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
    }

    const assetId = normalizeUuid(payload.id);
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
