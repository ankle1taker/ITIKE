import { z } from "zod";

/**
 * Validation schemas for auth forms.
 * Mirrors the backend's Zod schemas to catch errors early on the frontend.
 * Backend re-validates every request — this is defense in depth, not a substitute.
 */

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is invalid.")
  .max(20, "Phone number is invalid.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must not exceed 128 characters.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters.")
  .max(100, "Full name must not exceed 100 characters.");

/**
 * Login form schema. Uses phone (backend requires phone, not email).
 */
export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Register form schema. Creates CUSTOMER accounts only.
 * (The backend hardcodes role to CUSTOMER — we don't expose role selection.)
 */
export const registerSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Safe redirect validation — prevents open redirect attacks.
 *
 * A `from` parameter must be a path starting with "/" but NOT "//" or "/\".
 * This prevents:
 *   - from=//evil.com     (protocol-relative URL)
 *   - from=/\evil.com     (backslash bypass)
 *   - from=https://evil.com (absolute URL)
 *
 * Falls back to "/" if the value is unsafe.
 */
export function safeRedirectFrom(from: string | null | undefined): string {
  if (!from) return "/";
  if (typeof from !== "string") return "/";
  if (!from.startsWith("/")) return "/";
  if (from.startsWith("//")) return "/";
  if (from.startsWith("/\\")) return "/";
  return from;
}