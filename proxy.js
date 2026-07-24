import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getDefaultRouteForRole, roleHasRouteAccess } from "@/lib/roles";

const publicRoutes = [
  "/",
  "/login",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/booking",
  "/bookings",
  "/services",
];

function matchesRoute(pathname, route) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = await getSessionFromRequest(request);
  if (pathname === "/") return NextResponse.next();
  if (publicRoutes.some((route) => matchesRoute(pathname, route))) {
    if (session && (matchesRoute(pathname, "/login") || matchesRoute(pathname, "/auth"))) {
      return NextResponse.redirect(new URL(getDefaultRouteForRole(session.role), request.url));
    }
    return NextResponse.next();
  }

  // Default-deny: every non-public page is protected, including future routes.
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  if (!roleHasRouteAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(getDefaultRouteForRole(session.role), request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Vary", "Cookie");
  return response;
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
