const PRODUCTION_CANONICAL_HOST = "www.assetly.network";
const PRODUCTION_HOST_ALIASES = new Set([PRODUCTION_CANONICAL_HOST, "assetly.network"]);

const normalizeConfiguredUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (PRODUCTION_HOST_ALIASES.has(url.hostname)) {
      url.protocol = "https:";
      url.hostname = PRODUCTION_CANONICAL_HOST;
      url.port = "";
    }

    return url.origin;
  } catch {
    return null;
  }
};

export const resolveConfiguredAppOrigin = () => {
  const appUrl = normalizeConfiguredUrl(process.env.APP_URL);
  const publicAppUrl = normalizeConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (appUrl && publicAppUrl && appUrl !== publicAppUrl) {
    throw new Error(`App URL env mismatch: APP_URL=${appUrl} NEXT_PUBLIC_APP_URL=${publicAppUrl}`);
  }

  return appUrl ?? publicAppUrl;
};

export const requireConfiguredAppOrigin = () => {
  const appOrigin = resolveConfiguredAppOrigin();

  if (!appOrigin) {
    throw new Error("APP_URL or NEXT_PUBLIC_APP_URL is required.");
  }

  return appOrigin;
};
