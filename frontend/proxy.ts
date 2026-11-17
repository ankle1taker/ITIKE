import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";

/**
 * Next.js 16 proxy (formerly middleware.ts).
 *
 * Purpose: fast, first-line UX routing.
 *
 * This file DOES NOT verify token validity. It ONLY checks cookie presence
 * to make quick routing decisions:
 *   - No cookie + protected route → redirect to /login
 *   - Has cookie + auth page → redirect to / (session helper will re-route
 *     to the correct role destination from the page itself)
 *
 * Authoritative checks happen at TWO other layers:
 *   1. getServerSession() in Server Components — validates token via backend
 *   2. Express backend middleware — verifies role, company, branch, permissions
 *
 * A cookie existing does NOT mean a user is authenticated. It means
 * "try the request, and let the backend decide."
 */

// Routes that require an authenticated session to render.
const PROTECTED_PREFIXES = [
  "/account",
  "/company",
  "/admin",
  "/checkout",
  "/payment",
  "/ticket",
];

// Routes that a logged-in user shouldn't see (they're already in).
const AUTH_PAGES = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(appConfig.sessionCookieName)?.value;
  const hasCookie = Boolean(token);

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // No cookie + protected → redirect to login, preserving destination
  if (isProtected && !hasCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Has cookie + auth page → redirect home.
  // Home page (or a page it links to) will use getServerSession() to
  // pick the correct role-specific destination.
  if (isAuthPage && hasCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Note: this export is REQUIRED by Next.js and is separate from the
// app config imported above. Do not rename it.
export const config = {
  matcher: [
    /*
     * Match all routes except:
     *  - /api/*            (API routes handle auth themselves)
     *  - /_next/*          (Next.js internals)
     *  - /favicon.ico      (static)
     *  - /public/*         (static assets served at root)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};