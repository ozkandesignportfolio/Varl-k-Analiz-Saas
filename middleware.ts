import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseUserEmailConfirmed } from "./src/lib/supabase/auth-errors";

const protectedExactRoutes = new Set(["/dashboard", "/app", "/account", "/settings", "/billing"]);
const protectedRoutePrefixes = ["/dashboard/", "/app/", "/account/", "/settings/"] as const;

function isProtectedRoute(pathname: string) {
  if (protectedExactRoutes.has(pathname)) {
    return true;
  }

  return protectedRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

function buildLoginRedirectResponse(
  request: NextRequest,
  pathname: string,
  search: string,
  responseToCopy?: NextResponse,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", `${pathname}${search}`);

  const redirectResponse = NextResponse.redirect(redirectUrl);

  if (responseToCopy) {
    copyAuthCookies(responseToCopy, redirectResponse);
  }

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const { search } = request.nextUrl;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return buildLoginRedirectResponse(request, pathname, search);
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

  const authenticatedUser = user && isSupabaseUserEmailConfirmed(user) ? user : null;

  if (!authenticatedUser && user) {
    await supabase.auth.signOut();
  }

  if (userError || !authenticatedUser) {
    return buildLoginRedirectResponse(request, pathname, search, response);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/app/:path*", "/account/:path*", "/settings/:path*", "/billing"],
};
