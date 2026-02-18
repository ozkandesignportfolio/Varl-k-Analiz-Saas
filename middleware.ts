import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/assets",
  "/services",
  "/reports",
  "/billing",
  "/expenses",
  "/maintenance",
  "/documents",
  "/timeline",
  "/costs",
];

const authRoutes = ["/login", "/register"];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAuthRoute(pathname: string) {
  return authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
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

  const { pathname, search } = request.nextUrl;
  const isProtected = isProtectedRoute(pathname);
  const isAuth = isAuthRoute(pathname);

  if ((userError || !user) && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", `${pathname}${search}`);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyAuthCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (user && isAuth) {
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
  matcher: [
    "/dashboard/:path*",
    "/assets/:path*",
    "/services/:path*",
    "/billing/:path*",
    "/reports/:path*",
    "/expenses/:path*",
    "/maintenance/:path*",
    "/documents/:path*",
    "/timeline/:path*",
    "/costs/:path*",
    "/login",
    "/register",
  ],
};
