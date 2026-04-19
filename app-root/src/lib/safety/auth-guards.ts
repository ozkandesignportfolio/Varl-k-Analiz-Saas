import { getAllowedAppOrigins } from "@/lib/env/public-env";
import { Runtime } from "@/lib/env/runtime";

const FALLBACK_PATH = "/";
const PARSE_BASE = "https://assetly.local";

const normalizeOrigin = (origin: string | null | undefined): string | null => {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
};

const normalizeRelativePath = (candidate: string): string | null => {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    return null;
  }

  return candidate;
};

export function isAllowedAuthOrigin(origin: string | null | undefined): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  const allowedOrigins = getAllowedAppOrigins();

  if (Runtime.isClient()) {
    const currentOrigin = normalizeOrigin(window.location.origin);
    if (currentOrigin) {
      allowedOrigins.push(currentOrigin);
    }
  }

  return new Set(allowedOrigins).has(normalized);
}

export function validateRedirectUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const directPath = normalizeRelativePath(trimmed);
  if (directPath) {
    return directPath;
  }

  try {
    const parsed = new URL(trimmed, PARSE_BASE);
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);

    if (isAbsolute && !isAllowedAuthOrigin(parsed.origin)) {
      return null;
    }

    const normalized = normalizeRelativePath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
    return normalized;
  } catch {
    return null;
  }
}

export function safeRedirect(base: string, path: string | null | undefined): string {
  const safePath = validateRedirectUrl(path) ?? FALLBACK_PATH;

  try {
    const baseUrl = new URL(base);
    return new URL(safePath, baseUrl.origin).toString();
  } catch {
    return safePath;
  }
}
