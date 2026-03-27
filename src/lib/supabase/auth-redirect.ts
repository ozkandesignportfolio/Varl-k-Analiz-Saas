import { requireConfiguredAppOrigin, resolveConfiguredAppOrigin } from "@/lib/config/app-url";

const normalizePath = (path: string) => {
  if (!path) return "/";
  if (path.startsWith("/")) return path;
  return `/${path}`;
};

export const getAuthRedirectUrl = (path: string) => {
  const normalizedPath = normalizePath(path);
  const envBaseUrl = resolveConfiguredAppOrigin();

  if (!envBaseUrl) {
    return undefined;
  }

  return `${envBaseUrl}${normalizedPath}`;
};

export const requireAuthRedirectUrl = (path: string) => {
  return `${requireConfiguredAppOrigin()}${normalizePath(path)}`;
};
