"use client";

import { Menu, Bell, Building2, ChevronDown } from "lucide-react";
import { UserMenu } from "./user-menu";
import type { AuthUser } from "@/lib/api/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Topbar({ user }: { user: AuthUser }) {
  return (
    <header className="h-20 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-slate-500 hover:text-slate-900">
          <Menu className="h-6 w-6" />
        </button>
        <div className="hidden md:flex items-center gap-2 text-slate-600 font-medium">
          <Building2 className="h-5 w-5" />
          <span>Rwanda Transport Co.</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative text-slate-500 hover:text-slate-900">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            3
          </span>
        </button>

        <div className="flex items-center gap-3 pl-6 border-l">
          <Avatar className="h-9 w-9 bg-blue-100 text-blue-700 font-bold">
            <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block text-sm">
            <p className="font-semibold text-slate-900 leading-tight">{user.fullName}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              COMPANY ADMIN <ChevronDown className="h-3 w-3" />
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
