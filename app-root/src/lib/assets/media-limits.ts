export type AssetMediaType = "image" | "video" | "audio";

type AssetMediaTypeLimit = {
  maxFiles: number;
  maxFileSizeBytes: number;
};

export const ASSET_MEDIA_BUCKET = "asset-media";
export const ASSET_MEDIA_TOTAL_LIMIT_BYTES = 30 * 1024 * 1024;
export const ASSET_MEDIA_TOTAL_LIMIT_MESSAGE = "Bu varlık için toplam medya limiti 30 MB.";

export const ASSET_MEDIA_LIMITS: Record<AssetMediaType, AssetMediaTypeLimit> = {
  image: {
    maxFiles: 5,
    maxFileSizeBytes: 3 * 1024 * 1024,
  },
  video: {
    maxFiles: 1,
    maxFileSizeBytes: 20 * 1024 * 1024,
  },
  audio: {
    maxFiles: 1,
    maxFileSizeBytes: 10 * 1024 * 1024,
  },
};

export const ASSET_MEDIA_MIME_TYPES: Record<AssetMediaType, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"],
  audio: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/webm",
    "audio/ogg",
  ],
};

export const ASSET_MEDIA_EXTENSIONS: Record<AssetMediaType, readonly string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "heic"],
  video: ["mp4", "mov", "qt", "webm", "mkv"],
  audio: ["mp3", "mpeg", "wav", "m4a", "mp4", "webm", "ogg"],
};

const COMPATIBLE_EXTENSIONS_BY_MIME_TYPE: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov", "qt"],
  "video/webm": ["webm"],
  "video/x-matroska": ["mkv"],
  "audio/mpeg": ["mp3", "mpeg"],
  "audio/mp3": ["mp3"],
  "audio/wav": ["wav"],
  "audio/x-wav": ["wav"],
  "audio/mp4": ["m4a", "mp4"],
  "audio/m4a": ["m4a", "mp4"],
  "audio/webm": ["webm"],
  "audio/ogg": ["ogg"],
};

const maxSizeErrorByType: Record<AssetMediaType, string> = {
  image: "Fotoğraf dosyası en fazla 3 MB olabilir.",
  video: "Video en fazla 20 MB olabilir.",
  audio: "Ses dosyası en fazla 10 MB olabilir.",
};

const maxCountErrorByType: Record<AssetMediaType, string> = {
  image: "En fazla 5 fotoğraf ekleyebilirsiniz.",
  video: "En fazla 1 video ekleyebilirsiniz.",
  audio: "En fazla 1 ses dosyası ekleyebilirsiniz.",
};

export type AssetMediaValidationError = {
  status: 400 | 413;
  message: string;
};

export const isAssetMediaType = (value: string): value is AssetMediaType =>
  value === "image" || value === "video" || value === "audio";

export const getAssetMediaCountError = (type: AssetMediaType) => maxCountErrorByType[type];

export const getAssetMediaSizeError = (type: AssetMediaType) => maxSizeErrorByType[type];

export const getFileExtension = (fileName: string) => {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return null;
  }

  return parts[parts.length - 1]?.toLowerCase().trim() ?? null;
};

export const toMegabytesLabel = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function validateAssetMediaFile(
  file: File,
  type: AssetMediaType,
): AssetMediaValidationError | null {
  if (file.size <= 0) {
    return {
      status: 400,
      message: "Boş dosya yüklenemez.",
    };
  }

  const limit = ASSET_MEDIA_LIMITS[type];
  if (file.size > limit.maxFileSizeBytes) {
    return {
      status: 413,
      message: getAssetMediaSizeError(type),
    };
  }

  const mimeType = file.type.trim().toLowerCase();
  const allowedMimeTypes = ASSET_MEDIA_MIME_TYPES[type];
  if (!mimeType || !allowedMimeTypes.includes(mimeType)) {
    return {
      status: 400,
      message: `${type.toUpperCase()} dosya tipi desteklenmiyor.`,
    };
  }

  const extension = getFileExtension(file.name);
  const allowedExtensions = ASSET_MEDIA_EXTENSIONS[type];
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      status: 400,
      message: `${type.toUpperCase()} dosya uzantısı desteklenmiyor.`,
    };
  }

  const compatibleExtensions = COMPATIBLE_EXTENSIONS_BY_MIME_TYPE[mimeType];
  if (compatibleExtensions && !compatibleExtensions.includes(extension)) {
    return {
      status: 400,
      message: "Dosya uzantısı ve MIME tipi eşleşmiyor.",
    };
  }

  return null;
}

