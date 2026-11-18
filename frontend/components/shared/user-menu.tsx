"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { LogOut, User, LayoutDashboard, Search } from "lucide-react";
import type { AuthUser } from "@/lib/api/types";

interface UserMenuProps {
  user: AuthUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      queryClient.clear();
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const isCompany =
    user.role === "COMPANY_ADMIN" || user.role === "COMPANY_OPERATOR";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none"
      >
        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg hover:bg-blue-200 transition-colors">
          {user.fullName.charAt(0).toUpperCase()}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md border border-slate-200 shadow-lg z-50 py-1">
          <div className="px-4 py-2 border-b">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-slate-500">{user.phone}</p>
            <p className="text-xs font-semibold text-blue-600 mt-1">
              {user.role.replace("_", " ")}
            </p>
          </div>

          <div className="py-1">
            {isCompany ? (
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/company/dashboard");
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" /> Company Dashboard
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/search");
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Search className="h-4 w-4" /> Search Buses
              </button>
            )}

            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/account/profile");
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            >
              <User className="h-4 w-4" /> Profile
            </button>
          </div>

          <div className="border-t py-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}