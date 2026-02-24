import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDevelopmentEnvironment, isEmailNotConfirmedError } from "./src/lib/supabase/auth-errors";

const protectedRoutes = [
  "/dashboard",
  "/assets",
  "/services",
  "/reports",
  "/expenses",
  "/maintenance",
  "/documents",
  "/timeline",
  "/costs",
  "/notifications",
  "/settings",
];

const authRoutes = ["/login", "/register"];
const middlewareBypassPrefixes = ["/api/", "/billing/", "/_next/"] as const;
const middlewareBypassExactPaths = new Set(["/api", "/billing", "/_next", "/favicon.ico"]);

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthRoute(pathname: string) {
  return authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isBypassPath(pathname: string) {
  if (middlewareBypassExactPaths.has(pathname)) {
    return true;
  }

  return middlewareBypassPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function getSafeInternalPath(target: string | null) {
  if (!target) {
    return null;
  }

  if (!target.startsWith("/") || target.startsWith("//")) {
    return null;
  }

  return target;
}

function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/billing/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Never run auth redirects for API/static/billing framework paths.
  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  let authenticatedUser = user;
  let authenticatedUserError = userError;

  if (!authenticatedUser && userError && isDevelopmentEnvironment() && isEmailNotConfirmedError(userError)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      authenticatedUser = session.user;
      authenticatedUserError = null;
    }
  }

  const isProtected = isProtectedRoute(pathname);
  const isAuth = isAuthRoute(pathname);

  if ((authenticatedUserError || !authenticatedUser) && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyAuthCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (authenticatedUser && isAuth) {
    const redirectUrl = request.nextUrl.clone();
    const nextPath = getSafeInternalPath(request.nextUrl.searchParams.get("next"));
    if (nextPath) {
      const parsedTarget = new URL(nextPath, request.url);
      redirectUrl.pathname = parsedTarget.pathname;
      redirectUrl.search = parsedTarget.search;
    } else {
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
    }

    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyAuthCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
