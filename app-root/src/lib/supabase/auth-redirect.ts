import { getConfiguredAppOrigin, resolveConfiguredAppOrigin } from "@/lib/config/app-url";

const normalizePath = (path: string) => {
  if (!path) return "/";
  if (path.startsWith("/")) return path;
  return `/${path}`;
};

export const describeAuthRedirectUrl = (path: string) => {
  const normalizedPath = normalizePath(path);
  const configuredOrigin = resolveConfiguredAppOrigin();

  return {
    path: normalizedPath,
    configuredOrigin,
    url: configuredOrigin ? `${configuredOrigin}${normalizedPath}` : undefined,
  };
};

export const getAuthRedirectUrl = (path: string) => {
  return describeAuthRedirectUrl(path).url;
};

export const requireAuthRedirectUrl = (path: string) => {
  // Use non-throwing getConfiguredAppOrigin to prevent Server Component
  // render crashes (login/verify-email pages) when NEXT_PUBLIC_APP_URL
  // is not set. Falls back to localhost — wrong in prod but doesn't 500.
  return `${getConfiguredAppOrigin()}${normalizePath(path)}`;
};
