import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseUserEmailConfirmed } from "./src/lib/supabase/auth-errors";

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

const authRoutes = ["/login", "/register", "/verify-email"];
const middlewareBypassPrefixes = ["/api/", "/billing/", "/_next/", "/icons/"] as const;
const middlewareBypassExactPaths = new Set([
  "/",
  "/api",
  "/billing",
  "/_next",
  "/icons",
  "/manifest.webmanifest",
  "/icon.png",
  "/apple-icon.png",
  "/favicon.ico",
  "/sw.js",
]);
const middlewareVerificationTypes = new Set(["signup", "email"]);

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

function buildEmailVerificationSuccessUrl(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/dashboard";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("email_verified", "1");
  return redirectUrl;
}

function buildCleanAuthRedirectUrl(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.searchParams.delete("code");
  redirectUrl.searchParams.delete("token_hash");
  redirectUrl.searchParams.delete("type");
  redirectUrl.searchParams.delete("error");
  redirectUrl.searchParams.delete("error_code");
  redirectUrl.searchParams.delete("error_description");
  return redirectUrl;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Never run auth/session logic for public entrypoints, framework assets, or PWA files.
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

  const authCode = request.nextUrl.searchParams.get("code")?.trim();
  const tokenHash = request.nextUrl.searchParams.get("token_hash")?.trim();
  const verificationType = request.nextUrl.searchParams.get("type")?.trim() ?? "";

  if (authCode) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);

    if (!exchangeError) {
      const successRedirect = buildEmailVerificationSuccessUrl(request);
      const redirectUrl = buildCleanAuthRedirectUrl(request);
      redirectUrl.pathname = successRedirect.pathname;
      redirectUrl.search = successRedirect.search;

      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyAuthCookies(response, redirectResponse);
      return redirectResponse;
    }
  }

  if (tokenHash && middlewareVerificationTypes.has(verificationType)) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: verificationType as "signup" | "email",
    });

    if (!verifyError) {
      const successRedirect = buildEmailVerificationSuccessUrl(request);
      const redirectUrl = buildCleanAuthRedirectUrl(request);
      redirectUrl.pathname = successRedirect.pathname;
      redirectUrl.search = successRedirect.search;

      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyAuthCookies(response, redirectResponse);
      return redirectResponse;
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  let authenticatedUser = user;
  const authenticatedUserError = userError;

  if (authenticatedUser && !isSupabaseUserEmailConfirmed(authenticatedUser)) {
    await supabase.auth.signOut();
    authenticatedUser = null;
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
