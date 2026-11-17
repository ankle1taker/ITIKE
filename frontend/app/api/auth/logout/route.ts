import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie.
 *
 * Note: The backend uses stateless JWTs, so there is no server-side
 * session to invalidate. The JWT remains technically valid until expiry,
 * but since it's stored only in an HttpOnly cookie that we're clearing,
 * the browser loses access to it immediately.
 *
 * Future improvement (v1.1): implement token blocklist on backend for
 * immediate revocation.
 */
export async function POST() {
  const response = NextResponse.json(
    { success: true, message: "Logged out." },
    { status: 200 },
  );

  response.cookies.set(config.sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}