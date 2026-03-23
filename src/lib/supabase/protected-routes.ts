export const PROTECTED_APP_PATH_PREFIXES = [
  "/dashboard",
  "/assets",
  "/maintenance",
  "/services",
  "/documents",
  "/timeline",
  "/expenses",
  "/notifications",
  "/billing",
  "/invoices",
  "/costs",
  "/reports",
  "/settings",
  "/subscriptions",
] as const;

export const isProtectedAppPath = (pathname: string) =>
  PROTECTED_APP_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const PROTECTED_APP_MATCHERS = PROTECTED_APP_PATH_PREFIXES.map((prefix) => `${prefix}/:path*`);
