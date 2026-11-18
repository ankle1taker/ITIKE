import type { ReactNode } from "react";

/**
 * Auth layout. Minimal, centered, mobile-first.
 * No site header, no footer — just the form card.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}