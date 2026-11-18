"use client";

import Link from "next/link";
import { UserMenu } from "./user-menu";
import type { AuthUser } from "@/lib/api/types";
import { Bus } from "lucide-react";

export function Navbar({ user }: { user: AuthUser | null }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between mx-auto px-4 max-w-7xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Bus className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Itike</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Search
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Log in
              </Link>
              <Link href="/register" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
