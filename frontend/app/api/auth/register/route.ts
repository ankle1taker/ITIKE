import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * POST /api/auth/register
 *
 * Proxies to Express POST /api/auth/register.
 * On success, sets HttpOnly cookie and returns { user }.
 * The user is auto-logged-in after registration.
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

  const backendRes = await fetch(`${config.backendApiUrl}/api/auth/register`, {
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
    return NextResponse.json(
      json || { success: false, message: "Registration failed." },
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
    { status: 201 },
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