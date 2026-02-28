const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TextParseResult = {
  value: string | null;
  invalidType?: true;
  missing?: true;
  tooLong?: true;
};

export type DateRangeParseResult = {
  startDate: string | null;
  endDate: string | null;
  invalidStart: boolean;
  invalidEnd: boolean;
  invalidRange: boolean;
};

export type FileConstraintsOptions = {
  allowedMimeTypes?: readonly string[];
  allowedExtensions?: readonly string[];
  compatibleExtensionsByMimeType?: Record<string, readonly string[]>;
};

export type FileConstraintsResult =
  | {
      mimeType: string;
      extension: string;
    }
  | {
      error: string;
    };

export type PaginationSchemaConfig = {
  fallback: number;
  max: number;
};

export const normalizePageSize = (value: string | null, fallback: number, max: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, parsed);
};

export const parseDateOnly = (value: string) => {
  const trimmed = value.trim();
  if (!DATE_ONLY_PATTERN.test(trimmed)) {
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

export const parseDateOnlyToDate = (value: string) => {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = parsed.split("-");
  return new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw)));
};

export const uuid = () => (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

export const optionalText = (maxLength: number) => {
  const safeMaxLength = Math.max(0, maxLength);

  return (value: unknown, options: { required?: boolean } = {}): TextParseResult => {
    if (value === null || value === undefined) {
      return options.required ? { value: null, missing: true } : { value: null };
    }

    if (typeof value !== "string") {
      return { value: null, invalidType: true };
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return options.required ? { value: null, missing: true } : { value: null };
    }

    if (trimmed.length > safeMaxLength) {
      return { value: null, tooLong: true };
    }

    return { value: trimmed };
  };
};

export const dateRange = () => (startValue: unknown, endValue: unknown): DateRangeParseResult => {
  const startRaw = typeof startValue === "string" ? startValue : "";
  const endRaw = typeof endValue === "string" ? endValue : "";

  const startDate = startRaw ? parseDateOnly(startRaw) : null;
  const endDate = endRaw ? parseDateOnly(endRaw) : null;

  const invalidStart = Boolean(startRaw) && !startDate;
  const invalidEnd = Boolean(endRaw) && !endDate;
  const invalidRange = Boolean(startDate && endDate && endDate < startDate);

  return {
    startDate,
    endDate,
    invalidStart,
    invalidEnd,
    invalidRange,
  };
};

export const getFileExtension = (fileName: string) => {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return null;
  }

  return parts[parts.length - 1]?.toLowerCase().trim() ?? null;
};

export const fileConstraints = (type: string, maxFileSizeBytes: number) => {
  const normalizedType = type.trim().toLowerCase() || "dosya";

  return (file: File, options: FileConstraintsOptions = {}): FileConstraintsResult => {
    if (file.size <= 0) {
      return { error: `Bos ${normalizedType} yuklenemez.` };
    }

    if (Number.isFinite(maxFileSizeBytes) && maxFileSizeBytes > 0 && file.size > maxFileSizeBytes) {
      const mbLimit = Math.floor(maxFileSizeBytes / (1024 * 1024));
      return { error: `${normalizedType} boyutu ${mbLimit} MB sinirini asiyor.` };
    }

    const mimeType = file.type.trim().toLowerCase();
    if (options.allowedMimeTypes && (!mimeType || !options.allowedMimeTypes.includes(mimeType))) {
      return { error: `Desteklenmeyen ${normalizedType} tipi: ${mimeType || "unknown"}.` };
    }

    const extension = getFileExtension(file.name);
    if (options.allowedExtensions && (!extension || !options.allowedExtensions.includes(extension))) {
      return { error: `${normalizedType} uzantisi desteklenmiyor: ${extension || "unknown"}.` };
    }

    if (options.compatibleExtensionsByMimeType && extension) {
      const compatible = options.compatibleExtensionsByMimeType[mimeType];
      if (compatible && !compatible.includes(extension)) {
        return { error: `${normalizedType} uzantisi ve MIME tipi uyusmuyor: ${mimeType} / .${extension}.` };
      }
    }

    return {
      mimeType,
      extension: extension ?? "",
    };
  };
};

export const paginationSchema = <TCursor>(
  cursorParser: (params: URLSearchParams) => TCursor | null,
  pageSizeConfig: PaginationSchemaConfig,
) => {
  return (params: URLSearchParams) => ({
    cursor: cursorParser(params),
    pageSize: normalizePageSize(params.get("pageSize"), pageSizeConfig.fallback, pageSizeConfig.max),
  });
};
