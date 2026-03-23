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

const resolveConfiguredBaseUrl = () =>
  normalizeBaseUrl(process.env.APP_URL) ??
  normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);

export const getAuthRedirectUrl = (path: string) => {
  const normalizedPath = normalizePath(path);
  const envBaseUrl = resolveConfiguredBaseUrl();

  if (!envBaseUrl) {
    return undefined;
  }

  return `${envBaseUrl}${normalizedPath}`;
};

export const requireAuthRedirectUrl = (path: string) => {
  const redirectUrl = getAuthRedirectUrl(path);

  if (!redirectUrl) {
    throw new Error("APP_URL or NEXT_PUBLIC_APP_URL is required for auth email redirects.");
  }

  return redirectUrl;
};
