/**
 * Browser-side API client.
 *
 * Security:
 * - All calls go to same-origin Next.js BFF routes only.
 * - Paths must start with "/api/" (relative). Absolute URLs are rejected.
 * - Methods are whitelisted.
 * - Credentials included automatically (HttpOnly cookie).
 * - 204 No Content handled without attempting JSON parse.
 * - Non-2xx responses normalized to ApiError.
 */

import { ApiError } from "./errors";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const ALLOWED_METHODS: HttpMethod[] = ["GET", "POST", "PATCH", "PUT", "DELETE"];

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Only allow relative paths starting with "/api/".
 * This prevents accidental (or malicious) cross-origin calls.
 */
function assertSafePath(path: string) {
  if (typeof path !== "string" || !path.startsWith("/api/")) {
    throw new ApiError(
      `Unsafe API path: "${path}". Must start with /api/.`,
      400,
    );
  }
  if (path.startsWith("//") || path.includes("://")) {
    throw new ApiError(`Absolute URLs are not allowed: "${path}".`, 400);
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  assertSafePath(path);

  const method = options.method ?? "GET";
  if (!ALLOWED_METHODS.includes(method)) {
    throw new ApiError(`Unsupported method: ${method}`, 400);
  }

  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
    signal: options.signal,
    cache: "no-store", // avoid stale authenticated responses
  });

  // 204 No Content — no body to parse
  if (res.status === 204) {
    return undefined as T;
  }

  let json: unknown = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const body = json as
      | { message?: string; errors?: unknown[]; requestId?: string }
      | null;
    throw new ApiError(
      body?.message || `Request failed (${res.status})`,
      res.status,
      {
        fieldErrors: body?.errors as never,
        requestId: body?.requestId,
      },
    );
  }

  if (!json || typeof json !== "object") {
    throw new ApiError("Malformed response from server.", res.status);
  }

  const data = (json as ApiSuccessResponse<T>).data;
  if (data === undefined) {
    throw new ApiError("Response missing 'data' field.", res.status);
  }
  return data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};