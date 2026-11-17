import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * GET /api/auth/session
 *
 * Returns the current authenticated user, or 401 if not authenticated.
 * Reads the HttpOnly cookie, calls Express /api/auth/me with Bearer token.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(config.sessionCookieName)?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Not authenticated." },
      { status: 401 },
    );
  }

  const backendRes = await fetch(`${config.backendApiUrl}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!backendRes.ok) {
    // Token invalid or expired — clear cookie and return 401
    const response = NextResponse.json(
      { success: false, message: "Session expired." },
      { status: 401 },
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

  let json: unknown = null;
  try {
    json = await backendRes.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Malformed backend response." },
      { status: 502 },
    );
  }

  const user = (json as { data?: { user?: unknown } })?.data?.user;

  if (!user) {
    return NextResponse.json(
      { success: false, message: "Malformed backend response." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, data: { user } }, { status: 200 });
}