import { requireConfiguredAppOrigin, resolveConfiguredAppOrigin } from "@/lib/config/app-url";

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
  return `${requireConfiguredAppOrigin()}${normalizePath(path)}`;
};
