"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { postLoginRedirect } from "@/lib/config";
import { safeRedirectFrom } from "./validation";
import type { LoginResponse, RegisterResponse } from "@/lib/api/types";
import type { LoginInput, RegisterInput } from "./validation";

/**
 * Login mutation. On success:
 * - Sets session cookie (handled by BFF)
 * - Redirects to `from` parameter if safe, otherwise by user role
 *
 * Errors: shows toast with backend message.
 */
export function useLogin(from?: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<LoginResponse>("/api/auth/login", input),
    onSuccess: (data) => {
      queryClient.clear(); // clear any stale user-specific cached data
      const user = data.user;

      toast.success(`Welcome back, ${user.fullName}!`);

      const safeFrom = safeRedirectFrom(from);
      const destination =
        safeFrom !== "/" ? safeFrom : postLoginRedirect[user.role];

      router.push(destination);
      router.refresh(); // refresh server components with new cookie
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      toast.error(message);
    },
  });
}

/**
 * Register mutation. On success, auto-login (BFF sets cookie) and redirects
 * to /search (customer default).
 */
export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<RegisterResponse>("/api/auth/register", input),
    onSuccess: (data) => {
      queryClient.clear();
      toast.success(`Welcome to Itike, ${data.user.fullName}!`);
      router.push(postLoginRedirect[data.user.role]);
      router.refresh();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      toast.error(message);
    },
  });
}