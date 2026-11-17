import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * POST /api/auth/login
 *
 * Proxies to Express POST /api/auth/login.
 * Extracts accessToken from backend response.
 * Sets HttpOnly cookie.
 * Returns ONLY { user } to the browser — token never leaves the server.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const backendRes = await fetch(`${config.backendApiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: unknown = null;
  try {
    json = await backendRes.json();
  } catch {
    // ignore
  }

  if (!backendRes.ok) {
    // Forward backend error body + status unchanged
    return NextResponse.json(
      json || { success: false, message: "Login failed." },
      { status: backendRes.status },
    );
  }

  const data = (json as { data?: { user?: unknown; accessToken?: string } })
    ?.data;
  const user = data?.user;
  const accessToken = data?.accessToken;

  if (!user || !accessToken) {
    return NextResponse.json(
      { success: false, message: "Malformed backend response." },
      { status: 502 },
    );
  }

  const response = NextResponse.json(
    { success: true, data: { user } },
    { status: 200 },
  );

  response.cookies.set(config.sessionCookieName, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionMaxAgeSeconds,
  });

  return response;
}