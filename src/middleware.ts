import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export const runtime = "experimental-edge";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes: tracking pixels/clicks (hit by external mail clients),
  // auth endpoints, the login page, Next internals, and static assets.
  if (
    pathname.startsWith("/api/track") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuth = await verifySessionToken(token);

  if (!isAuth) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
