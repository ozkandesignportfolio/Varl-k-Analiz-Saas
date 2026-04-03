import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminUser } from "./src/lib/auth/admin-user";
import { isSupabaseUserEmailConfirmed } from "./src/lib/supabase/auth-errors";
import { buildLoginPath } from "./src/lib/supabase/email-verification";
import { isProtectedAppPath } from "./src/lib/supabase/protected-routes";

function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
}

function buildLoginRedirectResponse(
  request: NextRequest,
  pathname: string,
  search: string,
  options?: { email?: string | null; emailVerificationRequired?: boolean },
  responseToCopy?: NextResponse,
) {
  const redirectUrl = request.nextUrl.clone();
  const loginPath = buildLoginPath(`${pathname}${search}`, {
    email: options?.email,
    emailVerificationRequired: options?.emailVerificationRequired,
  });
  const [loginPathname, loginSearch = ""] = loginPath.split("?");
  redirectUrl.pathname = loginPathname;
  redirectUrl.search = loginSearch ? `?${loginSearch}` : "";

  const redirectResponse = NextResponse.redirect(redirectUrl);

  if (responseToCopy) {
    copyAuthCookies(responseToCopy, redirectResponse);
  }

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isFraudDashboardPath = pathname === "/fraud-dashboard" || pathname.startsWith("/fraud-dashboard/");

  if (!isProtectedAppPath(pathname)) {
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
    return buildLoginRedirectResponse(
      request,
      pathname,
      search,
      {
        email: user?.email ?? null,
        emailVerificationRequired: Boolean(user) && !authenticatedUser,
      },
      response,
    );
  }

  if (isFraudDashboardPath && !isAdminUser(authenticatedUser)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
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
    "/maintenance/:path*",
    "/services/:path*",
    "/documents/:path*",
    "/timeline/:path*",
    "/expenses/:path*",
    "/notifications/:path*",
    "/billing/:path*",
    "/invoices/:path*",
    "/costs/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/subscriptions/:path*",
    "/fraud-dashboard/:path*",
  ],
};
