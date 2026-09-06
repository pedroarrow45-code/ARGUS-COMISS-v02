import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSessionCookieName } from "@/lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  cookieStore.set(getSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.redirect(new URL("/login", request.url), 303);
}
