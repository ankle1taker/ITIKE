"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider.
 * One QueryClient instance per browser session (created lazily in useState
 * so it survives React strict-mode double-invocation).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s — reasonable for most data
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0, // never auto-retry mutations (they may be payment-related)
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}