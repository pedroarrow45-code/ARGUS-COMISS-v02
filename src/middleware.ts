import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionCookieName, validateSessionToken } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/setup", "/api/setup", "/api/auth/login", "/api/auth/logout"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    const sessionToken = request.cookies.get(getSessionCookieName())?.value;
    const isAuthenticated = await validateSessionToken(sessionToken);

    if (pathname === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  const isAuthenticated = await validateSessionToken(sessionToken);

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
