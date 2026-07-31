import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getDefaultRouteForRole, roleHasRouteAccess } from "@/lib/roles";

const protectedRoutes = [
  "/dashboard",
  "/projects",
  "/my-tasks",
  "/my-desk",
  "/activity",
  "/attendance",
  "/reports",
  "/users",
];

const authRoutes = ["/auth", "/login", "/auth/set-password"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const allCookies = request.cookies.getAll().map(c => `${c.name}=${c.value ? '[EXISTS]' : '[EMPTY]'}`).join(", ");
  console.log(`[Middleware] Protected Path: ${pathname}, Cookies: ${allCookies}`);

  let session = null;
  try {
    session = await getSessionFromRequest(request);
    console.log(`[Middleware] Session:`, session ? { id: session.id, role: session.role } : null);
  } catch (err) {
    console.error(`[Middleware] Error getting session:`, err);
  }

  if (!session) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/login";
    signInUrl.searchParams.set("denied", "1");
    signInUrl.searchParams.set("reason", "Please sign in to continue.");
    return NextResponse.redirect(signInUrl);
  }

  if (!roleHasRouteAccess(session.role, pathname)) {
    const fallbackUrl = request.nextUrl.clone();
    fallbackUrl.pathname = getDefaultRouteForRole(session.role);
    fallbackUrl.searchParams.set("denied", "1");
    fallbackUrl.searchParams.set(
      "reason",
      "You do not have access to that area."
    );
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
