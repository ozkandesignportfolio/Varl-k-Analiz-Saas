const normalizeBaseUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const normalizePath = (path: string) => {
  if (!path) return "/";
  if (path.startsWith("/")) return path;
  return `/${path}`;
};

export const getAuthRedirectUrl = (path: string) => {
  const normalizedPath = normalizePath(path);

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${normalizedPath}`;
  }

  const envBaseUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.APP_URL);

  if (!envBaseUrl) {
    return undefined;
  }

  return `${envBaseUrl}${normalizedPath}`;
};
