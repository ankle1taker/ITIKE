/**
 * Shared API response types. Mirrors backend response shapes.
 *
 * IMPORTANT: LoginResponse does NOT include accessToken. The BFF route
 * (server-side) receives the accessToken and sets it as an HttpOnly cookie.
 * The browser never sees it. This is intentional — see Phase 2 design notes.
 */

import type { UserRole } from "../config";

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
}

/**
 * What the browser receives from POST /api/auth/login.
 * No token. The cookie holds the credential.
 */
export interface LoginResponse {
  user: AuthUser;
}

/**
 * What the browser receives from POST /api/auth/register.
 */
export interface RegisterResponse {
  user: AuthUser;
}

/**
 * What the browser receives from GET /api/auth/session.
 * Returns null-ish (handled by 401) when not authenticated.
 */
export interface SessionResponse {
  user: AuthUser;
}