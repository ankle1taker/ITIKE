import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * Proxy to backend for all authenticated requests.
 *
 * Route: /api/backend/*  →  ${BACKEND_API_URL}/api/*
 *
 * Example:
 *   /api/backend/company/buses  →  http://localhost:5000/api/company/buses
 *   /api/backend/customer/bookings  →  http://localhost:5000/api/customer/bookings
 *
 * Security:
 * 1. Reads HttpOnly session cookie, extracts JWT.
 * 2. Forwards as Authorization: Bearer <token> to Express.
 * 3. Validates Origin header for CSRF on mutating methods.
 * 4. Whitelists allowed HTTP methods.
 * 5. Restricts forwarded headers to prevent header injection.
 * 6. Returns 401 if no cookie present.
 *
 * What this does NOT do (by design — backend is source of truth):
 * - Does not verify role/permission (backend does)
 * - Does not check companyId/branchId scope (backend does)
 * - Does not validate business rules (backend does)
 */

const ALLOWED_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const MUTATING_METHODS = ["POST", "PATCH", "PUT", "DELETE"];

// Only these headers are forwarded from client → Express.
// Cookies, host, connection, etc. are stripped.
const FORWARDED_HEADERS = ["content-type", "accept"];

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  // 1. Method check
  if (!ALLOWED_METHODS.includes(request.method)) {
    return NextResponse.json(
      { success: false, message: "Method not allowed." },
      { status: 405 },
    );
  }

  // 2. CSRF check for mutating methods
  if (MUTATING_METHODS.includes(request.method)) {
    const origin = request.headers.get("origin");
    const allowedOrigins = [
      config.appUrl,
      // allow localhost variant if config uses production URL
      "http://localhost:3000",
    ];
    if (!origin || !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { success: false, message: "Invalid request origin." },
        { status: 403 },
      );
    }
  }

  // 3. Auth check
  const token = request.cookies.get(config.sessionCookieName)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  // 4. Build backend URL
  const params = await context.params;
  const pathSegments = params.path || [];
  const path = "/" + pathSegments.join("/");

  const url = new URL(request.url);
  const backendUrl = `${config.backendApiUrl}/api${path}${url.search}`;

  // 5. Forward only allowed headers
  const forwardedHeaders = new Headers();
  request.headers.forEach((value, key) => {
    if (FORWARDED_HEADERS.includes(key.toLowerCase())) {
      forwardedHeaders.set(key, value);
    }
  });
  forwardedHeaders.set("Authorization", `Bearer ${token}`);

  // 6. Read body (only for mutating methods)
  let body: string | undefined;
  if (MUTATING_METHODS.includes(request.method)) {
    body = await request.text();
  }

  // 7. Forward to Express
  const backendRes = await fetch(backendUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body,
    cache: "no-store",
  });

  // 8. Return response unchanged
  const responseText = await backendRes.text();
  const contentType =
    backendRes.headers.get("content-type") || "application/json";

  return new NextResponse(responseText, {
    status: backendRes.status,
    headers: { "content-type": contentType },
  });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };