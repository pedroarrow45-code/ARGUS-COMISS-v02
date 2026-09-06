import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createSessionToken,
  getSessionCookieName,
  getSessionTtlSeconds,
  validateSessionToken,
} from "@/lib/auth";
import { authenticateUser } from "@/lib/users";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await authenticateUser(email, password);

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const token = await createSessionToken(user.email);
  const cookieStore = await cookies();

  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return NextResponse.redirect(new URL("/", request.url), 303);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const isAuthenticated = await validateSessionToken(token);

  if (isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
