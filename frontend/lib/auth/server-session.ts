import { cookies } from "next/headers";
import { config } from "@/lib/config";
import type { AuthUser } from "@/lib/api/types";

/**
 * Server-side session helper.
 *
 * Reads the HttpOnly session cookie, validates it against the backend,
 * and returns the authenticated user (or null).
 *
 * IMPORTANT: This must run only on the server (Server Components,
 * Route Handlers, Server Actions). The access token never leaves this
 * function — the caller receives only the parsed user object.
 *
 * Design:
 * - Uses AbortSignal.timeout() to prevent hanging on slow backend
 * - Handles malformed JSON responses gracefully (returns null, not throw)
 * - cache: "no-store" — never cache authenticated lookups
 * - Never logs the token
 */

const BACKEND_TIMEOUT_MS = 5000;

export async function getServerSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(config.sessionCookieName)?.value;

  if (!token) return null;

  try {
    const res = await fetch(`${config.backendApiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      // Malformed JSON — fail safe, do not throw
      return null;
    }

    const user = (json as { data?: { user?: unknown } })?.data?.user;
    if (!user || typeof user !== "object") return null;

    // Validate the minimum required fields — defensive against
    // backend shape changes.
    const u = user as Record<string, unknown>;
    if (
      typeof u.id !== "string" ||
      typeof u.fullName !== "string" ||
      typeof u.phone !== "string" ||
      typeof u.role !== "string"
    ) {
      return null;
    }

    return user as AuthUser;
  } catch {
    // Network error, timeout, or other failure — fail safe
    return null;
  }
}